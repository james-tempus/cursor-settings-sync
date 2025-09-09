import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { GitHubAPI } from "./github-api";

interface CursorSettings {
  settings: any;
  keybindings: any;
  extensions: string[];
  workspaceState: any;
}

let githubAPI: GitHubAPI;

export function activate(context: vscode.ExtensionContext) {
  // Initialize GitHub API
  githubAPI = new GitHubAPI();

  // Check if GitHub is configured on startup
  githubAPI.loadConfig().then(isConfigured => {
    if (!isConfigured) {
      vscode.window.showInformationMessage(
        'Git Sync: GitHub not configured. Run "Git Sync: Setup GitHub Sync" to get started.',
        'Setup Now'
      ).then(selection => {
        if (selection === 'Setup Now') {
          vscode.commands.executeCommand('gitSync.setupGitHubSync');
        }
      });
    }
  });

  // Original ignore/focus commands
  let ignoreDisposable = vscode.commands.registerCommand(
    "gitSync.wrapWithIgnore",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);

        editor.edit((editBuilder) => {
          editBuilder.replace(
            selection,
            `<!-- cursor-ignore -->\n${text}\n<!-- cursor-ignore-end -->`
          );
        });
      }
    }
  );

  let focusDisposable = vscode.commands.registerCommand(
    "gitSync.wrapWithFocus",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);

        editor.edit((editBuilder) => {
          editBuilder.replace(
            selection,
            `<!-- cursor-focus -->\n${text}\n<!-- cursor-focus-end -->`
          );
        });
      }
    }
  );

  // GitHub setup command
  let setupDisposable = vscode.commands.registerCommand(
    "gitSync.setupGitHubSync",
    async () => {
      try {
        const authenticated = await githubAPI.authenticate();
        if (authenticated) {
          const gistSelected = await githubAPI.selectOrCreateGist();
          if (gistSelected) {
            vscode.window.showInformationMessage(
              "GitHub sync setup completed successfully!"
            );
          } else {
            vscode.window.showWarningMessage(
              "GitHub sync setup cancelled"
            );
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to setup GitHub sync: ${error}`);
      }
    }
  );

  // New settings sync commands
  let exportDisposable = vscode.commands.registerCommand(
    "gitSync.exportSettings",
    async () => {
      try {
        if (githubAPI.isConfigured()) {
          const settings = await getCursorSettings();
          const success = await githubAPI.uploadSettings(settings);
          if (success) {
            vscode.window.showInformationMessage(
              "Settings exported to GitHub Gist successfully"
            );
          }
        } else {
          // Fallback to local export
          await exportCursorSettings();
          vscode.window.showInformationMessage(
            "Settings exported locally. Run 'Git Sync: Setup GitHub Sync' for cloud sync."
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
      }
    }
  );

  let importDisposable = vscode.commands.registerCommand(
    "gitSync.importSettings",
    async () => {
      try {
        if (githubAPI.isConfigured()) {
          const settings = await githubAPI.downloadSettings();
          if (settings) {
            await applyCursorSettings(settings);
            vscode.window.showInformationMessage(
              "Settings imported from GitHub Gist successfully"
            );
          }
        } else {
          // Fallback to local import
          await importCursorSettings();
          vscode.window.showInformationMessage(
            "Settings imported locally. Run 'Git Sync: Setup GitHub Sync' for cloud sync."
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
      }
    }
  );

  let syncDisposable = vscode.commands.registerCommand(
    "gitSync.syncSettings",
    async () => {
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
            vscode.window.showInformationMessage(
              "Settings synced with GitHub Gist successfully"
            );
          }
        } else {
          // Fallback to local sync
          await exportCursorSettings();
          await importCursorSettings();
          vscode.window.showInformationMessage(
            "Settings synced locally. Run 'Git Sync: Setup GitHub Sync' for cloud sync."
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to sync settings: ${error}`);
      }
    }
  );

  context.subscriptions.push(
    ignoreDisposable,
    focusDisposable,
    setupDisposable,
    exportDisposable,
    importDisposable,
    syncDisposable
  );
}

async function getCursorSettings(): Promise<CursorSettings> {
  return {
    settings: vscode.workspace.getConfiguration("cursor"),
    keybindings: await getKeybindings(),
    extensions: await getInstalledExtensions(),
    workspaceState: await getWorkspaceState(),
  };
}

async function applyCursorSettings(settings: CursorSettings): Promise<void> {
  // Apply settings
  await vscode.workspace
    .getConfiguration("cursor")
    .update("", settings.settings, true);
  await setKeybindings(settings.keybindings);
  await installExtensions(settings.extensions);
  await setWorkspaceState(settings.workspaceState);
}

async function exportCursorSettings(): Promise<void> {
  const globalStoragePath = path.join(os.homedir(), ".cursor-global");

  // Ensure global storage exists
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }

  const settings: CursorSettings = {
    settings: vscode.workspace.getConfiguration("cursor"),
    keybindings: await getKeybindings(),
    extensions: await getInstalledExtensions(),
    workspaceState: await getWorkspaceState(),
  };

  fs.writeFileSync(
    path.join(globalStoragePath, "cursor-settings.json"),
    JSON.stringify(settings, null, 2)
  );
}

async function importCursorSettings(): Promise<void> {
  const globalStoragePath = path.join(os.homedir(), ".cursor-global");
  const settingsPath = path.join(globalStoragePath, "cursor-settings.json");

  if (!fs.existsSync(settingsPath)) {
    throw new Error("No settings file found");
  }

  const settings: CursorSettings = JSON.parse(
    fs.readFileSync(settingsPath, "utf8")
  );

  // Apply settings
  await vscode.workspace
    .getConfiguration("cursor")
    .update("", settings.settings, true);
  await setKeybindings(settings.keybindings);
  await installExtensions(settings.extensions);
  await setWorkspaceState(settings.workspaceState);
}

async function getKeybindings(): Promise<any> {
  const keybindingsPath = path.join(
    os.homedir(),
    ".cursor",
    "User",
    "keybindings.json"
  );
  if (fs.existsSync(keybindingsPath)) {
    return JSON.parse(fs.readFileSync(keybindingsPath, "utf8"));
  }
  return {};
}

async function setKeybindings(keybindings: any): Promise<void> {
  const keybindingsPath = path.join(
    os.homedir(),
    ".cursor",
    "User",
    "keybindings.json"
  );
  fs.writeFileSync(keybindingsPath, JSON.stringify(keybindings, null, 2));
}

async function getInstalledExtensions(): Promise<string[]> {
  return vscode.extensions.all
    .filter((ext) => !ext.packageJSON.isBuiltin)
    .map((ext) => ext.id);
}

async function installExtensions(extensions: string[]): Promise<void> {
  for (const ext of extensions) {
    try {
      await vscode.commands.executeCommand(
        "workbench.extensions.installExtension",
        ext
      );
    } catch (error) {
      console.error(`Failed to install extension ${ext}:`, error);
    }
  }
}

async function getWorkspaceState(): Promise<any> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return {};

  const statePath = path.join(workspacePath, ".cursor", "workspace-state.json");
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  return {};
}

async function setWorkspaceState(state: any): Promise<void> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return;

  const cursorPath = path.join(workspacePath, ".cursor");
  if (!fs.existsSync(cursorPath)) {
    fs.mkdirSync(cursorPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(cursorPath, "workspace-state.json"),
    JSON.stringify(state, null, 2)
  );
}
