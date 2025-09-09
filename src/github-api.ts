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

// OAuth configuration - using GitHub Device Flow
const OAUTH_CLIENT_ID = 'Ov23liJ8Z8X9Q2K3m4N7'; // GitHub OAuth App ID
const OAUTH_SCOPE = 'gist';

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
      // Use GitHub Device Flow for OAuth
      const deviceResponse = await axios.post('https://github.com/login/device/code', {
        client_id: OAUTH_CLIENT_ID,
        scope: OAUTH_SCOPE
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const { device_code, user_code, verification_uri, interval } = deviceResponse.data;
      
      // Show progress message with device code
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "GitHub Authentication",
        cancellable: true
      }, async (progress, token) => {
        // Show the device code to user
        const openBrowser = await vscode.window.showInformationMessage(
          `GitHub Authentication Required\n\n1. Go to: ${verification_uri}\n2. Enter code: ${user_code}\n3. Click "Authorize"`,
          'Open Browser',
          'Cancel'
        );

        if (openBrowser === 'Open Browser') {
          await vscode.env.openExternal(vscode.Uri.parse(verification_uri));
        } else {
          return false;
        }

        // Poll for access token
        progress.report({ message: "Waiting for authorization..." });
        
        const accessToken = await this.pollForAccessToken(device_code, interval, token);
        
        if (accessToken) {
          progress.report({ message: "Verifying access token..." });
          
          // Test the token
          this.client.defaults.headers.common['Authorization'] = `token ${accessToken}`;
          const response = await this.client.get('/user');
          
          if (response.status === 200) {
            this.config = { token: accessToken, gistId: '', gistDescription: '' };
            await this.saveConfig();
            
            vscode.window.showInformationMessage(
              `Successfully authenticated as ${response.data.login}`
            );
            return true;
          }
        }
        
        return false;
      });
      
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to authenticate with GitHub. Please try again.'
      );
      return false;
    }
  }

  private async pollForAccessToken(deviceCode: string, interval: number, cancellationToken: vscode.CancellationToken): Promise<string | null> {
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
    let attempts = 0;

    while (attempts < maxAttempts && !cancellationToken.isCancellationRequested) {
      try {
        const response = await axios.post('https://github.com/login/oauth/access_token', {
          client_id: OAUTH_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (response.data.access_token) {
          return response.data.access_token;
        }

        if (response.data.error === 'authorization_pending') {
          // Wait for the specified interval before trying again
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          attempts++;
        } else if (response.data.error === 'expired_token') {
          vscode.window.showErrorMessage('Authentication code expired. Please try again.');
          return null;
        } else if (response.data.error === 'access_denied') {
          vscode.window.showErrorMessage('Authentication was denied. Please try again.');
          return null;
        } else {
          vscode.window.showErrorMessage(`Authentication error: ${response.data.error_description || response.data.error}`);
          return null;
        }
      } catch (error) {
        console.error('Error polling for access token:', error);
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        attempts++;
      }
    }

    if (cancellationToken.isCancellationRequested) {
      vscode.window.showInformationMessage('Authentication cancelled.');
    } else {
      vscode.window.showErrorMessage('Authentication timed out. Please try again.');
    }

    return null;
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
