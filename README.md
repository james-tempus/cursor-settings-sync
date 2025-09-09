# Cursor Settings Sync Extension

A VSCode extension for Cursor that enables seamless synchronization of settings, keybindings, and extensions across multiple workspaces and machines.

## Features

- 🔄 **Sync Settings** - Synchronize Cursor settings across multiple installations
- ⌨️ **Keybinding Sync** - Keep your custom keybindings consistent
- 🔌 **Extension Management** - Automatically install/update extensions
- 💾 **Export/Import** - Manual backup and restore functionality
- 🎯 **Workspace State** - Preserve workspace-specific configurations
- 🚀 **Real-time Sync** - Automatic synchronization capabilities

## Installation

### Method 1: Install from VSIX (Recommended)

1. **Download the latest release** from the [Releases page](https://github.com/yourusername/cursor-settings-sync/releases)

2. **Install the extension**:
   ```bash
   cursor --install-extension cursor-settings-sync-1.0.0.vsix
   ```

3. **Restart Cursor** to activate the extension

### Method 2: Build from Source

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/cursor-settings-sync.git
   cd cursor-settings-sync
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run compile
   ```

4. **Package the extension**:
   ```bash
   npm install -g vsce
   vsce package
   ```

5. **Install the packaged extension**:
   ```bash
   cursor --install-extension cursor-settings-sync-1.0.0.vsix
   ```

## Usage

### Command Palette

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type:

- `Cursor: Export Settings` - Export current settings to file
- `Cursor: Import Settings` - Import settings from file
- `Cursor: Sync Settings` - Export and import settings
- `Cursor: Wrap with Ignore` - Wrap selected text with ignore comments
- `Cursor: Wrap with Focus` - Wrap selected text with focus comments

### Keyboard Shortcuts

| Command | Windows/Linux | Mac |
|---------|---------------|-----|
| Export Settings | `Ctrl+Alt+E` | `Cmd+Alt+E` |
| Import Settings | `Ctrl+Alt+M` | `Cmd+Alt+M` |
| Sync Settings | `Ctrl+Alt+S` | `Cmd+Alt+S` |
| Wrap with Ignore | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| Wrap with Focus | `Ctrl+Alt+F` | `Cmd+Alt+F` |

### Programmatic Usage

```typescript
// Export settings
await vscode.commands.executeCommand("cursor.exportSettings");

// Import settings
await vscode.commands.executeCommand("cursor.importSettings");

// Sync settings
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
    "workspaceName": "My Workspace",
    "workspaceFolders": ["/path/to/workspace"],
    "openEditors": ["/path/to/file.js"]
  }
}
```

## What Gets Synced

### Settings
- Cursor-specific settings
- Editor preferences
- UI customizations
- AI/Chat configurations

### Keybindings
- Custom keyboard shortcuts
- Command mappings
- Key combinations

### Extensions
- Installed extension IDs
- Extension configurations
- Extension-specific settings

### Workspace State
- Workspace name and folders
- Open editors
- Recent files
- Workspace-specific settings

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- TypeScript
- VSCode Extension CLI (vsce)

### Setup Development Environment

1. **Clone and install**:
   ```bash
   git clone https://github.com/yourusername/cursor-settings-sync.git
   cd cursor-settings-sync
   npm install
   ```

2. **Open in VSCode**:
   ```bash
   code cursor-settings-sync
   ```

3. **Press F5** to start debugging

### Building

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
vsce package
```

### Testing

```bash
# Run tests
npm test

# Lint code
npm run lint
```

## Troubleshooting

### Extension Not Appearing

1. **Restart Cursor** completely
2. **Reload window**: `Cmd+Shift+P` → "Developer: Reload Window"
3. **Check installation**: `cursor --list-extensions | grep cursor-settings-sync`

### Commands Not Working

1. **Verify extension is enabled** in Extensions panel
2. **Check keyboard shortcuts** in Keyboard Shortcuts settings
3. **Try Command Palette** method instead of shortcuts

### Settings Not Syncing

1. **Check file permissions** for `~/.cursor-global/` directory
2. **Verify JSON format** in `cursor-settings.json`
3. **Check console** for error messages

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Basic settings sync functionality
- Export/Import commands
- Keyboard shortcuts
- Extension management
- Workspace state preservation

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/cursor-settings-sync/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/yourusername/cursor-settings-sync/discussions)
- 📧 **Contact**: [Your Email](mailto:your.email@example.com)

## Acknowledgments

- Inspired by VSCode Settings Sync
- Built for the Cursor community
- Thanks to all contributors and users

---

**Made with ❤️ for Cursor users**