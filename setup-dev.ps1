<#
.SYNOPSIS
    Sets up the development environment for Cursor Settings Sync extension
.DESCRIPTION
    Installs all necessary development dependencies and configures the development environment
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

# Verify development tools
$requiredTools = @(
    @{Name = "node"; Message = "Node.js is required for development" },
    @{Name = "npm"; Message = "npm is required for development" },
    @{Name = "git"; Message = "git is required for version control" }
)

foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool.Name -ErrorAction SilentlyContinue)) {
        Write-Error $tool.Message
        exit 1
    }
}

# Install global development tools
$globalTools = @(
    @{Name = "typescript"; Package = "typescript" },
    @{Name = "vsce"; Package = "vsce" },
    @{Name = "eslint"; Package = "eslint" }
)

foreach ($tool in $globalTools) {
    if (-not (Get-Command $tool.Name -ErrorAction SilentlyContinue)) {
        Write-Host "Installing $($tool.Name) globally..."
        npm install -g $tool.Package
    }
}

# Setup development environment
Push-Location $RootPath
try {
    # Install dependencies
    Write-Host "Installing project dependencies..."
    npm install

    # Create .vscode directory if it doesn't exist
    $vscodePath = Join-Path $RootPath ".vscode"
    if (-not (Test-Path $vscodePath)) {
        New-Item -ItemType Directory -Path $vscodePath | Out-Null
    }

    # Create launch.json
    $launchConfig = @{
        version        = "0.2.0"
        configurations = @(
            @{
                name          = "Run Extension"
                type          = "extensionHost"
                request       = "launch"
                args          = @(
                    "--extensionDevelopmentPath=`${workspaceFolder}"
                )
                outFiles      = @(
                    "`${workspaceFolder}/out/**/*.js"
                )
                preLaunchTask = "npm: watch"
            }
        )
    }

    $launchPath = Join-Path $vscodePath "launch.json"
    $launchConfig | ConvertTo-Json -Depth 10 | Set-Content $launchPath

    # Create tasks.json
    $tasksConfig = @{
        version = "2.0.0"
        tasks   = @(
            @{
                type           = "npm"
                script         = "watch"
                problemMatcher = @(
                    "`$tsc-watch"
                )
                isBackground   = $true
                presentation   = @{
                    reveal = "never"
                }
                group          = @{
                    kind      = "build"
                    isDefault = $true
                }
            }
        )
    }

    $tasksPath = Join-Path $vscodePath "tasks.json"
    $tasksConfig | ConvertTo-Json -Depth 10 | Set-Content $tasksPath

    # Initialize git if not already initialized
    if (-not (Test-Path (Join-Path $RootPath ".git"))) {
        Write-Host "Initializing git repository..."
        git init
        
        # Create .gitignore
        @"
node_modules/
out/
*.vsix
.DS_Store
Thumbs.db
"@ | Set-Content (Join-Path $RootPath ".gitignore")
        
        git add .
        git commit -m "Initial commit"
    }

    Write-Host "Development environment setup complete!" -ForegroundColor Green
    Write-Host "You can now open the project in VSCode and start debugging."
}
catch {
    Write-Error "Setup failed: $_"
    exit 1
}
finally {
    Pop-Location
} 