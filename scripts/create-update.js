const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read the current version from tauri.conf.json
const tauriConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));
const currentVersion = tauriConfig.version;

// Define platforms and their corresponding files
const platforms = {
  'windows-x86_64': {
    url: `https://github.com/TimVanC/roi-mailchimp-reporter/releases/download/v${currentVersion}/ROIMailchimpReporter_Windows_x64.msi`,
    signature: '' // Will be filled by GitHub Actions
  },
  'darwin-aarch64': {
    url: `https://github.com/TimVanC/roi-mailchimp-reporter/releases/download/v${currentVersion}/ROIMailchimpReporter_macOS.zip`,
    signature: '' // Will be filled by GitHub Actions
  }
};

// Create the update manifest
const updateManifest = {
  version: currentVersion,
  notes: `Release v${currentVersion} - See the full changelog at https://github.com/TimVanC/roi-mailchimp-reporter/releases/tag/v${currentVersion}`,
  pub_date: new Date().toISOString(),
  platforms
};

// Write the update manifest
fs.writeFileSync(
  path.join(__dirname, '../updates.json'),
  JSON.stringify(updateManifest, null, 2)
);

console.log('Update manifest created successfully!'); 