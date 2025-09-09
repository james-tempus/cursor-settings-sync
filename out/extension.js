"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const github_api_1 = require("./github-api");
let githubAPI;
function activate(context) {
    // Initialize GitHub API
    githubAPI = new github_api_1.GitHubAPI();
    // Check if GitHub is configured on startup
    githubAPI.loadConfig().then(isConfigured => {
        if (!isConfigured) {
            vscode.window.showInformationMessage('Cursor Settings Sync: GitHub not configured. Run "Cursor: Setup GitHub Sync" to get started.', 'Setup Now').then(selection => {
                if (selection === 'Setup Now') {
                    vscode.commands.executeCommand('cursor.setupGitHubSync');
                }
            });
        }
    });
    // Original ignore/focus commands
    let ignoreDisposable = vscode.commands.registerCommand("cursor.wrapWithIgnore", () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            editor.edit((editBuilder) => {
                editBuilder.replace(selection, `<!-- cursor-ignore -->\n${text}\n<!-- cursor-ignore-end -->`);
            });
        }
    });
    let focusDisposable = vscode.commands.registerCommand("cursor.wrapWithFocus", () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            editor.edit((editBuilder) => {
                editBuilder.replace(selection, `<!-- cursor-focus -->\n${text}\n<!-- cursor-focus-end -->`);
            });
        }
    });
    // GitHub setup command
    let setupDisposable = vscode.commands.registerCommand("cursor.setupGitHubSync", async () => {
        try {
            const authenticated = await githubAPI.authenticate();
            if (authenticated) {
                const gistSelected = await githubAPI.selectOrCreateGist();
                if (gistSelected) {
                    vscode.window.showInformationMessage("GitHub sync setup completed successfully!");
                }
                else {
                    vscode.window.showWarningMessage("GitHub sync setup cancelled");
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to setup GitHub sync: ${error}`);
        }
    });
    // New settings sync commands
    let exportDisposable = vscode.commands.registerCommand("cursor.exportSettings", async () => {
        try {
            if (githubAPI.isConfigured()) {
                const settings = await getCursorSettings();
                const success = await githubAPI.uploadSettings(settings);
                if (success) {
                    vscode.window.showInformationMessage("Cursor settings exported to GitHub Gist successfully");
                }
            }
            else {
                // Fallback to local export
                await exportCursorSettings();
                vscode.window.showInformationMessage("Cursor settings exported locally. Run 'Cursor: Setup GitHub Sync' for cloud sync.");
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
        }
    });
    let importDisposable = vscode.commands.registerCommand("cursor.importSettings", async () => {
        try {
            if (githubAPI.isConfigured()) {
                const settings = await githubAPI.downloadSettings();
                if (settings) {
                    await applyCursorSettings(settings);
                    vscode.window.showInformationMessage("Cursor settings imported from GitHub Gist successfully");
                }
            }
            else {
                // Fallback to local import
                await importCursorSettings();
                vscode.window.showInformationMessage("Cursor settings imported locally. Run 'Cursor: Setup GitHub Sync' for cloud sync.");
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
        }
    });
    let syncDisposable = vscode.commands.registerCommand("cursor.syncSettings", async () => {
        try {
            if (githubAPI.isConfigured()) {
                // Export to GitHub
                const settings = await getCursorSettings();
                const uploadSuccess = await githubAPI.uploadSettings(settings);
                if (uploadSuccess) {
                    // Import from GitHub (to get latest changes)
                    const downloadedSettings = await githubAPI.downloadSettings();
                    if (downloadedSettings) {
                        await applyCursorSettings(downloadedSettings);
                    }
                    vscode.window.showInformationMessage("Cursor settings synced with GitHub Gist successfully");
                }
            }
            else {
                // Fallback to local sync
                await exportCursorSettings();
                await importCursorSettings();
                vscode.window.showInformationMessage("Cursor settings synced locally. Run 'Cursor: Setup GitHub Sync' for cloud sync.");
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to sync settings: ${error}`);
        }
    });
    context.subscriptions.push(ignoreDisposable, focusDisposable, setupDisposable, exportDisposable, importDisposable, syncDisposable);
}
exports.activate = activate;
async function getCursorSettings() {
    return {
        settings: vscode.workspace.getConfiguration("cursor"),
        keybindings: await getKeybindings(),
        extensions: await getInstalledExtensions(),
        workspaceState: await getWorkspaceState(),
    };
}
async function applyCursorSettings(settings) {
    // Apply settings
    await vscode.workspace
        .getConfiguration("cursor")
        .update("", settings.settings, true);
    await setKeybindings(settings.keybindings);
    await installExtensions(settings.extensions);
    await setWorkspaceState(settings.workspaceState);
}
async function exportCursorSettings() {
    const globalStoragePath = path.join(os.homedir(), ".cursor-global");
    // Ensure global storage exists
    if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
    }
    const settings = {
        settings: vscode.workspace.getConfiguration("cursor"),
        keybindings: await getKeybindings(),
        extensions: await getInstalledExtensions(),
        workspaceState: await getWorkspaceState(),
    };
    fs.writeFileSync(path.join(globalStoragePath, "cursor-settings.json"), JSON.stringify(settings, null, 2));
}
async function importCursorSettings() {
    const globalStoragePath = path.join(os.homedir(), ".cursor-global");
    const settingsPath = path.join(globalStoragePath, "cursor-settings.json");
    if (!fs.existsSync(settingsPath)) {
        throw new Error("No settings file found");
    }
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    // Apply settings
    await vscode.workspace
        .getConfiguration("cursor")
        .update("", settings.settings, true);
    await setKeybindings(settings.keybindings);
    await installExtensions(settings.extensions);
    await setWorkspaceState(settings.workspaceState);
}
async function getKeybindings() {
    const keybindingsPath = path.join(os.homedir(), ".cursor", "User", "keybindings.json");
    if (fs.existsSync(keybindingsPath)) {
        return JSON.parse(fs.readFileSync(keybindingsPath, "utf8"));
    }
    return {};
}
async function setKeybindings(keybindings) {
    const keybindingsPath = path.join(os.homedir(), ".cursor", "User", "keybindings.json");
    fs.writeFileSync(keybindingsPath, JSON.stringify(keybindings, null, 2));
}
async function getInstalledExtensions() {
    return vscode.extensions.all
        .filter((ext) => !ext.packageJSON.isBuiltin)
        .map((ext) => ext.id);
}
async function installExtensions(extensions) {
    for (const ext of extensions) {
        try {
            await vscode.commands.executeCommand("workbench.extensions.installExtension", ext);
        }
        catch (error) {
            console.error(`Failed to install extension ${ext}:`, error);
        }
    }
}
async function getWorkspaceState() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath)
        return {};
    const statePath = path.join(workspacePath, ".cursor", "workspace-state.json");
    if (fs.existsSync(statePath)) {
        return JSON.parse(fs.readFileSync(statePath, "utf8"));
    }
    return {};
}
async function setWorkspaceState(state) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath)
        return;
    const cursorPath = path.join(workspacePath, ".cursor");
    if (!fs.existsSync(cursorPath)) {
        fs.mkdirSync(cursorPath, { recursive: true });
    }
    fs.writeFileSync(path.join(cursorPath, "workspace-state.json"), JSON.stringify(state, null, 2));
}
//# sourceMappingURL=extension.js.map