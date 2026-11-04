import { Router } from 'express';
import { db, json } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { badRequest, handle } from '../errors.js';
import { validate } from '../validate.js';

const router = Router();
export const MOODS = ['great', 'okay', 'low', 'anxious', 'tired'];
const QUESTION_IDS = ['overall', 'stress', 'sleep', 'energy', 'connection'];

const toCheckin = (row) => ({
  id: row.id,
  mood: row.mood,
  answers: json.parse(row.answers, {}),
  note: row.note,
  createdAt: row.created_at,
});

router.use(requireAuth, requireRole('user'));

router.get('/', handle((req, res) => {
  const rows = db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY id DESC LIMIT 365').all(req.user.id);
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = rows.filter((r) => new Date(r.created_at).getTime() >= since);
  const weekCounts = Object.fromEntries(MOODS.map((m) => [m, week.filter((r) => r.mood === m).length]));
  res.json({ checkins: rows.map(toCheckin), summary: { lastSevenDays: week.length, counts: weekCounts } });
}));

router.post('/', handle((req, res) => {
  const body = validate(req.body, {
    mood: { type: 'string', required: true, enum: MOODS },
    answers: { type: 'object', default: {} },
    note: { type: 'string', max: 500 },
  });
  const answers = {};
  for (const [key, value] of Object.entries(body.answers)) {
    if (!QUESTION_IDS.includes(key)) continue;
    if (typeof value !== 'string' || value.length > 60) throw badRequest(`Answer for ${key} is invalid.`);
    answers[key] = value;
  }
  const info = db.prepare('INSERT INTO checkins (user_id, mood, answers, note) VALUES (?,?,?,?)')
    .run(req.user.id, body.mood, JSON.stringify(answers), body.note ?? null);
  const row = db.prepare('SELECT * FROM checkins WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ checkin: toCheckin(row) });
}));

router.delete('/', handle((req, res) => {
  const info = db.prepare('DELETE FROM checkins WHERE user_id = ?').run(req.user.id);
  res.json({ deleted: Number(info.changes) });
}));

export default router;
