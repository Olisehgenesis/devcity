/**
 * Decrypt the mounted .env inside this process.
 * Plaintext stays in memory. It is not written back to the container environment
 * config, and values Compose already set in plaintext (such as DATABASE_URL) are left alone.
 */
const fs = require('fs');
const path = require('path');

const envPath = process.env.DOTENV_FILE || path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) return;

const privateKey = process.env.DOTENV_PRIVATE_KEY;
if (!privateKey) return;

let dotenvx;
try {
  dotenvx = require('@dotenvx/dotenvx');
} catch {
  console.error('dotenvx is not installed; encrypted env values stay unread.');
  return;
}

const scratch = { DOTENV_PRIVATE_KEY: privateKey };
const result = dotenvx.config({
  path: envPath,
  overload: true,
  quiet: true,
  processEnv: scratch,
});

if (result && result.error && !Object.keys(scratch).some((key) => key !== 'DOTENV_PRIVATE_KEY')) {
  console.error('Could not decrypt .env');
  return;
}

for (const [key, value] of Object.entries(scratch)) {
  if (key === 'DOTENV_PRIVATE_KEY') continue;
  if (typeof value !== 'string' || value.startsWith('encrypted:')) continue;
  const current = process.env[key];
  if (!current || current.startsWith('encrypted:')) process.env[key] = value;
}
