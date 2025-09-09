import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface GitHubGist {
  id: string;
  description: string;
  public: boolean;
  files: { [key: string]: { content: string } };
  created_at: string;
  updated_at: string;
}

export interface GitHubConfig {
  token: string;
  gistId: string;
  gistDescription: string;
}


export class GitHubAPI {
  private client: AxiosInstance;
  private config: GitHubConfig | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cursor-Settings-Sync-Extension'
      }
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Show authentication options
      const authMethod = await vscode.window.showQuickPick([
        {
          label: '$(key) Use Personal Access Token',
          description: 'Enter your GitHub Personal Access Token',
          detail: 'Recommended: Create a token with gist permissions'
        },
        {
          label: '$(browser) Open GitHub to Create Token',
          description: 'Open GitHub in browser to create a new token',
          detail: 'Go to Settings > Developer settings > Personal access tokens'
        }
      ], {
        placeHolder: 'Choose how to authenticate with GitHub',
        ignoreFocusOut: true
      });

      if (!authMethod) {
        return false;
      }

      if (authMethod.label.includes('Open GitHub')) {
        // Open GitHub token creation page
        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens/new?scopes=gist&description=Git%20Sync%20Extension'));
        
        // Wait a moment then prompt for token
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.authenticateWithToken();
      } else {
        // Use token method
        return await this.authenticateWithToken();
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to authenticate with GitHub. Please try again.'
      );
      return false;
    }
  }

  private async authenticateWithToken(): Promise<boolean> {
    try {
      // Show instructions first
      const instructions = await vscode.window.showInformationMessage(
        'To use Git Sync, you need a GitHub Personal Access Token with gist permissions.\n\n' +
        '1. Go to GitHub Settings > Developer settings > Personal access tokens\n' +
        '2. Click "Generate new token (classic)"\n' +
        '3. Select "gist" scope\n' +
        '4. Copy the token and paste it below',
        'I have a token',
        'Open GitHub Settings',
        'Cancel'
      );

      if (instructions === 'Open GitHub Settings') {
        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens/new?scopes=gist&description=Git%20Sync%20Extension'));
        return false;
      }

      if (instructions !== 'I have a token') {
        return false;
      }

      // Prompt for GitHub token
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your GitHub Personal Access Token',
        placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || !value.startsWith('ghp_')) {
            return 'Please enter a valid GitHub Personal Access Token (starts with ghp_)';
          }
          return null;
        }
      });

      if (!token) {
        return false;
      }

      // Test the token
      this.client.defaults.headers.common['Authorization'] = `token ${token}`;
      const response = await this.client.get('/user');
      
      if (response.status === 200) {
        this.config = { token, gistId: '', gistDescription: '' };
        await this.saveConfig();
        
        vscode.window.showInformationMessage(
          `Successfully authenticated as ${response.data.login}`
        );
        return true;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to authenticate with GitHub. Please check your token.'
      );
      return false;
    }
    
    return false;
  }


  async selectOrCreateGist(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      // Get user's gists
      const response = await this.client.get('/gists');
      const gists: GitHubGist[] = response.data;

      // Filter for Git Sync gists
      const gitSyncGists = gists.filter(gist => 
        gist.description.includes('Git Sync') || 
        gist.description.includes('git-sync') ||
        gist.description.includes('Cursor Settings Sync') || 
        gist.description.includes('cursor-settings')
      );

      if (gitSyncGists.length > 0) {
        // Show existing gists
        const gistItems = gitSyncGists.map(gist => ({
          label: gist.description || `Gist ${gist.id}`,
          description: `Updated: ${new Date(gist.updated_at).toLocaleDateString()}`,
          gist: gist
        }));

        const selectedGist = await vscode.window.showQuickPick(
          [
            ...gistItems,
            { label: '$(add) Create New Gist', description: 'Create a new gist for Git Sync settings', gist: null }
          ],
          {
            placeHolder: 'Select an existing gist or create a new one',
            ignoreFocusOut: true
          }
        );

        if (!selectedGist) {
          return false;
        }

        if (selectedGist.gist) {
          // Use existing gist
          this.config.gistId = selectedGist.gist.id;
          this.config.gistDescription = selectedGist.gist.description;
        } else {
          // Create new gist
          return await this.createNewGist();
        }
      } else {
        // No existing gists, create new one
        return await this.createNewGist();
      }

      await this.saveConfig();
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to fetch gists. Please check your token permissions.'
      );
      return false;
    }
  }

  private async createNewGist(): Promise<boolean> {
    try {
      const description = await vscode.window.showInputBox({
        prompt: 'Enter a description for your Git Sync Settings Gist',
        placeHolder: 'Git Sync - My Settings',
        value: 'Git Sync - My Settings',
        ignoreFocusOut: true
      });

      if (!description) {
        return false;
      }

      const gistData = {
        description: description,
        public: false,
        files: {
          'git-sync-settings.json': {
            content: JSON.stringify({
              settings: {},
              keybindings: [],
              extensions: [],
              workspaceState: {},
              lastUpdated: new Date().toISOString()
            }, null, 2)
          }
        }
      };

      const response = await this.client.post('/gists', gistData);
      
      if (response.status === 201) {
        this.config!.gistId = response.data.id;
        this.config!.gistDescription = description;
        return true;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to create new gist. Please check your token permissions.'
      );
    }
    
    return false;
  }

  async uploadSettings(settings: any): Promise<boolean> {
    if (!this.config || !this.config.gistId) {
      return false;
    }

    try {
      const gistData = {
        description: this.config.gistDescription,
        files: {
          'git-sync-settings.json': {
            content: JSON.stringify({
              ...settings,
              lastUpdated: new Date().toISOString()
            }, null, 2)
          }
        }
      };

      const response = await this.client.patch(`/gists/${this.config.gistId}`, gistData);
      
      if (response.status === 200) {
        vscode.window.showInformationMessage('Settings uploaded to GitHub Gist successfully');
        return true;
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to upload settings to GitHub Gist');
    }
    
    return false;
  }

  async downloadSettings(): Promise<any | null> {
    if (!this.config || !this.config.gistId) {
      return null;
    }

    try {
      const response = await this.client.get(`/gists/${this.config.gistId}`);
      
      if (response.status === 200) {
        const gist: GitHubGist = response.data;
        const settingsFile = gist.files['git-sync-settings.json'];
        
        if (settingsFile) {
          const settings = JSON.parse(settingsFile.content);
          vscode.window.showInformationMessage('Settings downloaded from GitHub Gist successfully');
          return settings;
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to download settings from GitHub Gist');
    }
    
    return null;
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    const configPath = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(process.cwd()),
      '.vscode',
      'cursor-sync-config.json'
    );

    try {
      await vscode.workspace.fs.writeFile(
        configPath,
        Buffer.from(JSON.stringify(this.config, null, 2))
      );
    } catch (error) {
      // Fallback to local storage
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const globalStoragePath = path.join(os.homedir(), '.cursor-global');
      if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(globalStoragePath, 'cursor-sync-config.json'),
        JSON.stringify(this.config, null, 2)
      );
    }
  }

  async loadConfig(): Promise<boolean> {
    try {
      // Try workspace config first
      const configPath = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(process.cwd()),
        '.vscode',
        'cursor-sync-config.json'
      );

      try {
        const configData = await vscode.workspace.fs.readFile(configPath);
        this.config = JSON.parse(configData.toString());
      } catch {
        // Fallback to global storage
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const globalConfigPath = path.join(os.homedir(), '.cursor-global', 'cursor-sync-config.json');
        if (fs.existsSync(globalConfigPath)) {
          const configData = fs.readFileSync(globalConfigPath, 'utf8');
          this.config = JSON.parse(configData);
        }
      }

      if (this.config && this.config.token) {
        this.client.defaults.headers.common['Authorization'] = `token ${this.config.token}`;
        return true;
      }
    } catch (error) {
      // Config not found or invalid
    }
    
    return false;
  }

  isConfigured(): boolean {
    return this.config !== null && this.config.token !== '' && this.config.gistId !== '';
  }
}
