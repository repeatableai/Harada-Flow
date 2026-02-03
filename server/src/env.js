// This file must be imported first to ensure environment variables are loaded
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '.env');

// Parse and manually assign to process.env
const result = dotenv.config({ path: envPath });

if (result.parsed) {
  // Manually assign parsed values to process.env
  for (const [key, value] of Object.entries(result.parsed)) {
    process.env[key] = value;
  }
}

console.log('Environment loaded from:', envPath);
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'loaded' : 'NOT loaded');
