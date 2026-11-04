import { db, json } from '../db.js';
import { SPECIALITIES } from './questionBank.js';

const BASE_SELECT = `
  SELECT t.*, u.name, u.email
  FROM therapists t JOIN users u ON u.id = t.user_id
`;

export function initialsOf(name = '') {
  return name
    .replace(/^(Dr\.?|Ms\.?|Mr\.?|Mrs\.?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function toTherapist(row, { includeEmail = false } = {}) {
  if (!row) return null;
  const specialities = json.parse(row.specialities, []);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    initials: initialsOf(row.name),
    title: row.title,
    specialities,
    specialityLabels: specialities.map((k) => SPECIALITIES[k] || k),
    languages: json.parse(row.languages, []),
    experienceYears: row.experience_years,
    qualifications: row.qualifications,
    about: row.about,
    approach: row.approach,
    feeInr: row.fee_inr,
    sessionMinutes: row.session_minutes,
    workingDays: json.parse(row.working_days, []),
    slotTimes: json.parse(row.slot_times, []),
    status: row.status,
    ...(includeEmail ? { email: row.email } : {}),
  };
}

export function findTherapist(id) {
  return db.prepare(`${BASE_SELECT} WHERE t.id = ?`).get(id);
}

export function findTherapistByUser(userId) {
  return db.prepare(`${BASE_SELECT} WHERE t.user_id = ?`).get(userId);
}

export function listTherapists({ status = 'approved' } = {}) {
  const rows = status === 'all'
    ? db.prepare(`${BASE_SELECT} ORDER BY t.created_at DESC`).all()
    : db.prepare(`${BASE_SELECT} WHERE t.status = ? ORDER BY t.experience_years DESC`).all(status);
  return rows;
}

export function scheduleOf(row) {
  return {
    working_days: json.parse(row.working_days, []),
    slot_times: json.parse(row.slot_times, []),
  };
}
