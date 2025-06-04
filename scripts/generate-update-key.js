import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate the key pair (force overwrite, no password)
console.log('Generating update key pair (no password)...');
execSync('tauri signer generate --force --password "" -w ~/.tauri/roi-mailchimp-reporter.key');

// Read the public key file
const publicKeyPath = path.join(os.homedir(), '.tauri', 'roi-mailchimp-reporter.key.pub');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();

console.log('Generated public key:', publicKey);

// Update tauri.conf.json
const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Ensure app.updater section exists
if (!config.app) {
  config.app = {
    windows: [],
    security: { csp: null }
  };
}
if (!config.app.updater) {
  config.app.updater = {
    active: true,
    dialog: true,
    endpoints: [
      "https://github.com/TimVanC/roi-mailchimp-reporter/releases/latest/download/latest.json"
    ]
  };
}

config.app.updater.pubkey = publicKey;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Updated tauri.conf.json with public key'); 