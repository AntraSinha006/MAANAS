import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','therapist','admin')),
  age_group     TEXT,
  language      TEXT DEFAULT 'English',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS therapists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Counselling Psychologist',
  specialities    TEXT NOT NULL DEFAULT '[]',   -- JSON array of speciality keys
  languages       TEXT NOT NULL DEFAULT '["English"]',
  experience_years INTEGER NOT NULL DEFAULT 0,
  qualifications  TEXT,
  about           TEXT,
  approach        TEXT,
  fee_inr         INTEGER NOT NULL DEFAULT 500,
  session_minutes INTEGER NOT NULL DEFAULT 50,
  working_days    TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',            -- 0=Sun … 6=Sat (IST)
  slot_times      TEXT NOT NULL DEFAULT '["10:00","11:30","14:00","16:00","18:00"]', -- IST
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS assessments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers       TEXT NOT NULL,          -- JSON {itemId: 0..3}
  focus_task    TEXT,                   -- JSON {trials, correct, avgReactionMs}
  scores        TEXT NOT NULL,          -- JSON per-section results
  wellbeing_index INTEGER NOT NULL,     -- 0..100, higher = better
  overall_band  TEXT NOT NULL,
  recommended   TEXT NOT NULL,          -- JSON array of speciality keys
  crisis_flag   INTEGER NOT NULL DEFAULT 0,
  model_version TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS checkins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood       TEXT NOT NULL,
  answers    TEXT NOT NULL DEFAULT '{}',
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id    INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  start_at        TEXT NOT NULL,        -- UTC ISO timestamp
  duration_min    INTEGER NOT NULL,
  mode            TEXT NOT NULL DEFAULT 'video' CHECK (mode IN ('video','chat')),
  status          TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','confirmed','declined','cancelled','completed')),
  note            TEXT,
  assessment_id   INTEGER REFERENCES assessments(id) ON DELETE SET NULL,  -- shared only with consent
  fee_inr         INTEGER NOT NULL,
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  room_code       TEXT NOT NULL UNIQUE,
  therapist_notes TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- A therapist can hold at most one active booking per start time.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
  ON bookings(therapist_id, start_at) WHERE status IN ('requested','confirmed');

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS messages_by_booking ON messages(booking_id, id);
`;

export function migrate() {
  db.exec(SCHEMA);
}

/** Run fn inside a transaction; rolls back on any thrown error. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export const json = {
  parse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  },
};

export function nowIso() {
  return new Date().toISOString();
}
