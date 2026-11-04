import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..');
export const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '..', 'frontend');

// Minimal .env loader so the project runs without extra dependencies.
const envFile = path.join(BACKEND_ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'maanas-dev-secret-change-me',
  dbFile: path.resolve(BACKEND_ROOT, process.env.DB_FILE || './data/maanas.db'),
  otpMock: (process.env.OTP_MOCK ?? 'true') !== 'false',
  timezone: 'Asia/Kolkata',
  istOffsetMinutes: 330,
};
