<#
.SYNOPSIS
    Installs the Cursor Settings Sync extension
.DESCRIPTION
    Builds and installs the Cursor Settings Sync extension in the current Cursor installation
.NOTES
    Version: 1.0
    Author: Your Name
    Last Updated: 2024-01-04
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootPath = Split-Path -Parent $ScriptPath

# Verify Node.js installation
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required but not installed. Please install Node.js first."
    exit 1
}

# Verify npm installation
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is required but not installed. Please install npm first."
    exit 1
}

# Verify vsce installation
if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
    Write-Host "Installing vsce globally..."
    npm install -g vsce
}

# Install dependencies
Write-Host "Installing dependencies..."
Push-Location $RootPath
try {
    npm install
    
    # Build extension
    Write-Host "Building extension..."
    npm run compile
    
    # Package extension
    Write-Host "Packaging extension..."
    vsce package
    
    # Get the vsix file
    $vsixFile = Get-ChildItem -Path $RootPath -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if (-not $vsixFile) {
        throw "Failed to find .vsix file"
    }
    
    # Install extension in Cursor
    Write-Host "Installing extension in Cursor..."
    & code --install-extension $vsixFile.FullName
    
    Write-Host "Installation complete!" -ForegroundColor Green
    Write-Host "Restart Cursor to activate the extension."
}
catch {
    Write-Error "Installation failed: $_"
    exit 1
}
finally {
    Pop-Location
} 