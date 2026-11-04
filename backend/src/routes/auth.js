import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { config } from '../config.js';
import { db, transaction } from '../db.js';
import { publicUser, requireAuth, signToken } from '../auth.js';
import { AppError, badRequest, conflict, handle, unauthorized } from '../errors.js';
import { EMAIL, validate } from '../validate.js';
import { findTherapistByUser, toTherapist } from '../services/therapistRepo.js';

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Kannada'];
const AGE_GROUPS = ['Under 18', '18–24', '25–34', '35–49', '50+'];

function issueOtp(email) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO otp_codes (email, code, expires_at, attempts) VALUES (?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0
  `).run(email, code, expiresAt);

  if (config.otpMock) {
    console.log(`[OTP mock] verification code for ${email}: ${code}`);
    return { devCode: code };
  }
  // TODO: send via email/SMS provider (e.g. SES, MSG91) when OTP_MOCK=false.
  return {};
}

function sessionPayload(user) {
  const therapist = user.role === 'therapist' ? toTherapist(findTherapistByUser(user.id)) : null;
  return { token: signToken(user), user: publicUser(user), therapist };
}

router.post('/signup', handle((req, res) => {
  const body = validate(req.body, {
    name: { type: 'string', required: true, min: 2, max: 70 },
    email: { type: 'string', required: true, max: 120, pattern: EMAIL, patternMessage: 'is not a valid email' },
    password: { type: 'string', required: true, min: 8, max: 100, trim: false },
    ageGroup: { type: 'string', enum: AGE_GROUPS },
    language: { type: 'string', enum: LANGUAGES, default: 'English' },
    role: { type: 'string', enum: ['user', 'therapist'], default: 'user' },
  });
  const email = body.email.toLowerCase();

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing?.email_verified) throw conflict('An account with this email already exists. Please log in.');

  const hash = bcrypt.hashSync(body.password, 10);
  transaction(() => {
    if (existing) {
      // Unverified account: allow the person to restart sign-up.
      db.prepare('UPDATE users SET name=?, password_hash=?, role=?, age_group=?, language=? WHERE id=?')
        .run(body.name, hash, body.role, body.ageGroup ?? null, body.language, existing.id);
      db.prepare('DELETE FROM therapists WHERE user_id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO users (name, email, password_hash, role, age_group, language) VALUES (?,?,?,?,?,?)')
        .run(body.name, email, hash, body.role, body.ageGroup ?? null, body.language);
    }
    if (body.role === 'therapist') {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      db.prepare(`INSERT INTO therapists (user_id, languages, status) VALUES (?, ?, 'pending')`)
        .run(user.id, JSON.stringify([body.language]));
    }
  });

  const otp = issueOtp(email);
  res.status(201).json({ message: 'We sent a 6-digit verification code.', email, ...otp });
}));

router.post('/verify-otp', handle((req, res) => {
  const body = validate(req.body, {
    email: { type: 'string', required: true, pattern: EMAIL },
    code: { type: 'string', required: true, pattern: /^\d{6}$/, patternMessage: 'must be 6 digits' },
  });
  const email = body.email.toLowerCase();
  const otp = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(email);
  if (!otp) throw badRequest('No code was requested for this email. Please sign up or resend the code.');
  if (otp.attempts >= 5) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please request a new code.');
  if (new Date(otp.expires_at) < new Date()) throw badRequest('This code has expired. Please request a new one.');

  const a = Buffer.from(otp.code);
  const b = Buffer.from(body.code);
  if (!crypto.timingSafeEqual(a, b)) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
    throw badRequest('That code is not correct.');
  }

  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);
  db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run(email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  res.json(sessionPayload(user));
}));

router.post('/resend-otp', handle((req, res) => {
  const { email } = validate(req.body, { email: { type: 'string', required: true, pattern: EMAIL } });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  // Same response either way so the endpoint can't be used to discover accounts.
  const otp = user && !user.email_verified ? issueOtp(user.email) : {};
  res.json({ message: 'If that account is waiting for verification, a new code was sent.', ...otp });
}));

router.post('/login', handle((req, res) => {
  const body = validate(req.body, {
    email: { type: 'string', required: true, pattern: EMAIL, patternMessage: 'is not a valid email' },
    password: { type: 'string', required: true, trim: false },
  });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email.toLowerCase());
  if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
    throw unauthorized('Email or password is incorrect.');
  }
  if (!user.email_verified) {
    const otp = issueOtp(user.email);
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first. We sent a new code.', { email: user.email, ...otp });
  }
  res.json(sessionPayload(user));
}));

router.get('/me', requireAuth, handle((req, res) => {
  const { token, ...rest } = sessionPayload(req.user);
  res.json(rest);
}));

router.patch('/me', requireAuth, handle((req, res) => {
  const body = validate(req.body, {
    name: { type: 'string', min: 2, max: 70 },
    ageGroup: { type: 'string', enum: AGE_GROUPS },
    language: { type: 'string', enum: LANGUAGES },
  });
  db.prepare(`UPDATE users SET name = COALESCE(?, name), age_group = COALESCE(?, age_group), language = COALESCE(?, language) WHERE id = ?`)
    .run(body.name ?? null, body.ageGroup ?? null, body.language ?? null, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
}));

// Right to erasure: removes the account and (via ON DELETE CASCADE) all personal data.
router.delete('/me', requireAuth, handle((req, res) => {
  if (req.user.role === 'admin') throw badRequest('Admin accounts cannot be deleted from here.');
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ message: 'Your account and data have been deleted.' });
}));

router.get('/options', (_req, res) => res.json({ languages: LANGUAGES, ageGroups: AGE_GROUPS }));

export default router;
