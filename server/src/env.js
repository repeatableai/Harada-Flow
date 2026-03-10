// This file must be imported first to ensure environment variables are loaded
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '.env');

// Load .env but DON'T override existing environment variables
// This allows Render/production env vars to take precedence
dotenv.config({ path: envPath });
