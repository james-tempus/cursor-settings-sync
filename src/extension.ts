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
        'Git Sync: GitHub not configured. Run "Setup GitHub Sync" to get started.',
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
            "Settings exported locally. Run 'Setup GitHub Sync' for cloud sync."
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
            "Settings imported locally. Run 'Setup GitHub Sync' for cloud sync."
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
            "Settings synced locally. Run 'Setup GitHub Sync' for cloud sync."
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
    settings: vscode.workspace.getConfiguration(),
    keybindings: await getKeybindings(),
    extensions: await getInstalledExtensions(),
    workspaceState: await getWorkspaceState(),
  };
}

async function applyCursorSettings(settings: CursorSettings): Promise<void> {
  // Apply settings - only update valid configuration keys
  const config = vscode.workspace.getConfiguration();
  
  // List of valid configuration sections we can update
  const validConfigSections = [
    'workbench', 'editor', 'files', 'search', 'terminal', 'git', 
    'typescript', 'javascript', 'html', 'css', 'scss', 'less',
    'json', 'markdown', 'python', 'java', 'csharp', 'cpp', 'go',
    'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart', 'powershell',
    'shell', 'docker', 'yaml', 'xml', 'sql', 'graphql', 'vue',
    'react', 'angular', 'svelte', 'solid', 'prettier', 'eslint',
    'bracketPairColorizer', 'indentRainbow', 'colorHighlight',
    'todoHighlight', 'bookmarks', 'pathIntellisense', 'autoRenameTag',
    'bracketPairColorizer2', 'indentRainbow', 'colorize', 'highlight',
    'trailingSpaces', 'whitespace', 'trimTrailingWhitespace'
  ];
  
  for (const [key, value] of Object.entries(settings.settings)) {
    try {
      // Only try to update if it's a valid configuration section
      if (validConfigSections.some(section => key.startsWith(section + '.'))) {
        await config.update(key, value, true);
      }
    } catch (error) {
      // Skip invalid configuration keys
      console.log(`Skipping invalid configuration key: ${key}`);
    }
  }
  
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
    settings: vscode.workspace.getConfiguration(),
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

  // Apply settings - only update valid configuration keys
  const config = vscode.workspace.getConfiguration();
  
  // List of valid configuration sections we can update
  const validConfigSections = [
    'workbench', 'editor', 'files', 'search', 'terminal', 'git', 
    'typescript', 'javascript', 'html', 'css', 'scss', 'less',
    'json', 'markdown', 'python', 'java', 'csharp', 'cpp', 'go',
    'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart', 'powershell',
    'shell', 'docker', 'yaml', 'xml', 'sql', 'graphql', 'vue',
    'react', 'angular', 'svelte', 'solid', 'prettier', 'eslint',
    'bracketPairColorizer', 'indentRainbow', 'colorHighlight',
    'todoHighlight', 'bookmarks', 'pathIntellisense', 'autoRenameTag',
    'bracketPairColorizer2', 'indentRainbow', 'colorize', 'highlight',
    'trailingSpaces', 'whitespace', 'trimTrailingWhitespace'
  ];
  
  for (const [key, value] of Object.entries(settings.settings)) {
    try {
      // Only try to update if it's a valid configuration section
      if (validConfigSections.some(section => key.startsWith(section + '.'))) {
        await config.update(key, value, true);
      }
    } catch (error) {
      // Skip invalid configuration keys
      console.log(`Skipping invalid configuration key: ${key}`);
    }
  }
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
  
  // Ensure the directory exists
  const keybindingsDir = path.dirname(keybindingsPath);
  if (!fs.existsSync(keybindingsDir)) {
    fs.mkdirSync(keybindingsDir, { recursive: true });
  }
  
  fs.writeFileSync(keybindingsPath, JSON.stringify(keybindings, null, 2));
}

async function getInstalledExtensions(): Promise<string[]> {
  return vscode.extensions.all
    .filter((ext) => !ext.packageJSON.isBuiltin)
    .map((ext) => ext.id);
}

// Extension removal preferences
interface ExtensionRemovalPreferences {
  alwaysAllow: boolean;
  neverRemove: boolean;
}

async function getExtensionRemovalPreferences(): Promise<ExtensionRemovalPreferences> {
  const context = vscode.workspace.getConfiguration('gitSync');
  return {
    alwaysAllow: context.get('extensionRemoval.alwaysAllow', false),
    neverRemove: context.get('extensionRemoval.neverRemove', false)
  };
}

async function setExtensionRemovalPreferences(prefs: ExtensionRemovalPreferences): Promise<void> {
  const config = vscode.workspace.getConfiguration('gitSync');
  await config.update('extensionRemoval.alwaysAllow', prefs.alwaysAllow, true);
  await config.update('extensionRemoval.neverRemove', prefs.neverRemove, true);
}

async function confirmExtensionRemoval(extensionsToRemove: string[]): Promise<boolean> {
  const prefs = await getExtensionRemovalPreferences();
  
  // If user chose "Never Remove", don't remove any extensions
  if (prefs.neverRemove) {
    vscode.window.showInformationMessage(
      'Extension removal is disabled. No extensions will be removed.'
    );
    return false;
  }
  
  // If user chose "Always Allow", proceed without confirmation
  if (prefs.alwaysAllow) {
    return true;
  }
  
  // Show confirmation dialog with extension list
  const extensionList = extensionsToRemove.map((ext, index) => 
    `${index + 1}. ${ext}`
  ).join('\n');
  
  const message = `The following ${extensionsToRemove.length} extensions will be removed:\n\n${extensionList}\n\nDo you want to proceed?`;
  
  const choice = await vscode.window.showWarningMessage(
    message,
    {
      modal: true,
      detail: 'You can change this behavior in Git Sync settings.'
    },
    'Remove Extensions',
    'Always Allow',
    'Never Remove',
    'Skip This Time'
  );
  
  switch (choice) {
    case 'Remove Extensions':
      return true;
    case 'Always Allow':
      await setExtensionRemovalPreferences({ ...prefs, alwaysAllow: true });
      vscode.window.showInformationMessage(
        'Extension removal is now set to "Always Allow". You can change this in settings.'
      );
      return true;
    case 'Never Remove':
      await setExtensionRemovalPreferences({ ...prefs, neverRemove: true });
      vscode.window.showInformationMessage(
        'Extension removal is now disabled. You can change this in settings.'
      );
      return false;
    case 'Skip This Time':
    default:
      return false;
  }
}

async function installExtensions(targetExtensions: string[]): Promise<void> {
  const currentExtensions = vscode.extensions.all
    .filter((ext) => !ext.packageJSON.isBuiltin)
    .map((ext) => ext.id);

  // Find extensions to install (in target but not current)
  const extensionsToInstall = targetExtensions.filter(
    (ext) => !currentExtensions.includes(ext)
  );

  // Find extensions to remove (in current but not target)
  const extensionsToRemove = currentExtensions.filter(
    (ext) => !targetExtensions.includes(ext)
  );

  // Install new extensions
  for (const ext of extensionsToInstall) {
    try {
      await vscode.commands.executeCommand(
        "workbench.extensions.installExtension",
        ext
      );
      console.log(`Installed extension: ${ext}`);
    } catch (error) {
      console.error(`Failed to install extension ${ext}:`, error);
    }
  }

  // Remove old extensions (with confirmation)
  if (extensionsToRemove.length > 0) {
    const shouldRemove = await confirmExtensionRemoval(extensionsToRemove);
    
    if (shouldRemove) {
      for (const ext of extensionsToRemove) {
        try {
          await vscode.commands.executeCommand(
            "workbench.extensions.uninstallExtension",
            ext
          );
          console.log(`Removed extension: ${ext}`);
        } catch (error) {
          console.error(`Failed to remove extension ${ext}:`, error);
        }
      }
    }
  }

  if (extensionsToInstall.length > 0 || (extensionsToRemove.length > 0 && await getExtensionRemovalPreferences().then(p => !p.neverRemove))) {
    vscode.window.showInformationMessage(
      `Extensions updated: ${extensionsToInstall.length} installed, ${extensionsToRemove.length} removed`
    );
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
