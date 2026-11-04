import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { forbidden, unauthorized } from './errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ageGroup: row.age_group,
    language: row.language,
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
  };
}

/** Attaches req.user when a valid Bearer token is present; rejects otherwise. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return next(unauthorized('Your account no longer exists.'));
    req.user = user;
    next();
  } catch {
    next(unauthorized('Your session has expired. Please log in again.'));
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};
