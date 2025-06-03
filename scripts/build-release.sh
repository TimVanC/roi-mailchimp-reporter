#!/bin/bash

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Create distribution directories
mkdir -p distribution/{windows,macos}

# Build the application
echo "Building ROI Mailchimp Reporter..."
npm run tauri build

# Copy the built files to distribution
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Copying macOS build..."
    cp "src-tauri/target/release/bundle/dmg/ROI Mailchimp Reporter_1.0.0_x64.dmg" \
        "distribution/macos/ROIMailchimpReporter_macOS.dmg"
elif [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "win32"* ]]; then
    echo "Copying Windows build..."
    cp "src-tauri/target/release/bundle/msi/ROI Mailchimp Reporter_1.0.0_x64_en-US.msi" \
        "distribution/windows/ROIMailchimpReporter_Windows_x64.msi"
fi

echo "Build complete! Files are in the distribution directory." 