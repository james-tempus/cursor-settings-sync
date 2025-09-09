#!/bin/bash

# Git Sync Extension Build Script
# This script builds the extension and cleans up build artifacts

set -e

echo "🔨 Compiling TypeScript..."
npx tsc -p ./

echo "📦 Packaging extension..."
npx vsce package

echo "🧹 Cleaning up build artifacts..."
rm -rf out/
rm -rf node_modules/

echo "✅ Build complete!"
echo "📦 Extension package: git-sync-1.0.0.vsix"
echo "📋 To install: cursor --install-extension git-sync-1.0.0.vsix"
