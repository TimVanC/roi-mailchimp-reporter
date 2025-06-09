#!/bin/bash

# Exit on error
set -e

echo "🧹 Cleaning previous builds..."
rm -rf src-tauri/target
rm -rf dist
rm -f src-tauri/Cargo.lock

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "🦀 Building Tauri app..."
cd src-tauri
cargo build --release
cd ..

echo "🚀 Tauri release build completed!" 