import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate key pair
console.log('Generating update key pair...');
const keyPair = execSync('tauri signer generate -w ~/.tauri/roi-mailchimp-reporter.key').toString();

// Extract public key
const publicKey = keyPair.match(/Public key: ([^\n]+)/)[1];

// Update tauri.conf.json
const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.tauri.updater.pubkey = publicKey;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('Update key pair generated and configuration updated!');
console.log('Private key saved to: ~/.tauri/roi-mailchimp-reporter.key');
console.log('Public key:', publicKey); 