# Cursor Settings Sync Extension

A VSCode extension for Cursor that enables seamless synchronization of settings, keybindings, and extensions across multiple workspaces and machines.

## Features

- Sync settings across multiple Cursor installations
- Export/Import functionality
- Automatic workspace state preservation
- Keybinding synchronization
- Extension management
- Real-time sync capabilities

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/cursor-settings-sync.git
cd cursor-settings-sync
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run compile
```

4. Package the extension:

```bash
vsce package
```

5. Install in Cursor:

```bash
code --install-extension cursor-settings-sync-1.0.0.vsix
```

Alternatively, use the provided PowerShell script:

```powershell
.\scripts\install.ps1
```

## Usage

### Keyboard Shortcuts

- `Ctrl+Alt+E` (Windows) / `Cmd+Alt+E` (Mac) - Export settings
- `Ctrl+Alt+M` (Windows) / `Cmd+Alt+M` (Mac) - Import settings
- `Ctrl+Alt+S` (Windows) / `Cmd+Alt+S` (Mac) - Sync settings

### Command Palette

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type:

- `Cursor: Export Settings`
- `Cursor: Import Settings`
- `Cursor: Sync Settings`

### Programmatic Usage

```typescript
await vscode.commands.executeCommand("cursor.exportSettings");
await vscode.commands.executeCommand("cursor.importSettings");
await vscode.commands.executeCommand("cursor.syncSettings");
```

## Configuration

Settings are stored in `~/.cursor-global/cursor-settings.json` with the following structure:

```json
{
  "settings": {
    "cursor.ai": {
      "logging": {
        "enabled": true,
        "level": "debug"
      },
      "chat": {
        "saveHistory": true
      }
    }
  },
  "keybindings": [
    {
      "key": "ctrl+alt+i",
      "command": "cursor.wrapWithIgnore"
    }
  ],
  "extensions": ["extension.id1", "extension.id2"],
  "workspaceState": {
    // Workspace-specific settings
  }
}
```

## Development

1. Open in VSCode:

```bash
code cursor-settings-sync
```

2. Install development dependencies:

```powershell
.\scripts\setup-dev.ps1
```

3. Press F5 to start debugging

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Author

Your Name
