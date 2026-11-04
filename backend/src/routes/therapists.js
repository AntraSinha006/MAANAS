import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { badRequest, handle, notFound } from '../errors.js';
import { validate } from '../validate.js';
import { SPECIALITIES } from '../services/questionBank.js';
import { rankTherapists } from '../services/matching.js';
import { generateSlots } from '../services/slots.js';
import { findTherapist, findTherapistByUser, listTherapists, scheduleOf, toTherapist } from '../services/therapistRepo.js';
import { toAssessment } from './assessments.js';

const router = Router();

function takenStarts(therapistId) {
  const rows = db.prepare(`SELECT start_at FROM bookings WHERE therapist_id = ? AND status IN ('requested','confirmed')`).all(therapistId);
  return new Set(rows.map((r) => r.start_at));
}

router.get('/specialities', (_req, res) => {
  res.json({ specialities: Object.entries(SPECIALITIES).map(([key, label]) => ({ key, label })) });
});

// Public directory with search + filters.
router.get('/', handle((req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const speciality = String(req.query.speciality || '');
  const language = String(req.query.language || '');
  const therapists = listTherapists().map((row) => toTherapist(row)).filter((t) => {
    if (speciality && !t.specialities.includes(speciality)) return false;
    if (language && !t.languages.includes(language)) return false;
    if (q) {
      const haystack = [t.name, t.title, t.about, t.approach, ...t.specialityLabels, ...t.languages].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  res.json({ therapists });
}));

// Personalised matches based on the user's latest assessment.
router.get('/recommended', requireAuth, requireRole('user'), handle((req, res) => {
  const latest = toAssessment(db.prepare('SELECT * FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id));
  const therapists = listTherapists().map((row) => toTherapist(row));
  const ranked = rankTherapists(therapists, { recommended: latest?.recommended ?? [], language: req.user.language });
  res.json({ basedOn: latest ? { id: latest.id, createdAt: latest.createdAt, recommendedLabels: latest.recommendedLabels } : null, therapists: ranked });
}));

// ---- Therapist's own profile (therapist portal) ----
router.get('/me/profile', requireAuth, requireRole('therapist'), handle((req, res) => {
  res.json({ therapist: toTherapist(findTherapistByUser(req.user.id), { includeEmail: true }) });
}));

router.put('/me/profile', requireAuth, requireRole('therapist'), handle((req, res) => {
  const body = validate(req.body, {
    title: { type: 'string', required: true, min: 3, max: 80 },
    specialities: { type: 'array', required: true, max: 6 },
    languages: { type: 'array', required: true, max: 8 },
    experienceYears: { type: 'int', required: true, min: 0, max: 60 },
    qualifications: { type: 'string', max: 300 },
    about: { type: 'string', required: true, min: 20, max: 800 },
    approach: { type: 'string', max: 400 },
    feeInr: { type: 'int', required: true, min: 0, max: 20000 },
    sessionMinutes: { type: 'int', required: true, min: 20, max: 120 },
    workingDays: { type: 'array', required: true, max: 7 },
    slotTimes: { type: 'array', required: true, max: 12 },
  });
  if (!body.specialities.length || body.specialities.some((s) => !SPECIALITIES[s])) throw badRequest('Choose at least one valid speciality.');
  if (!body.languages.length || body.languages.some((l) => typeof l !== 'string')) throw badRequest('Choose at least one language.');
  if (body.workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw badRequest('Working days are invalid.');
  if (!body.slotTimes.length || body.slotTimes.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw badRequest('Slot times must look like 09:30.');

  const slotTimes = [...new Set(body.slotTimes)].sort();
  db.prepare(`
    UPDATE therapists SET title=?, specialities=?, languages=?, experience_years=?, qualifications=?, about=?, approach=?,
      fee_inr=?, session_minutes=?, working_days=?, slot_times=?
    WHERE user_id = ?
  `).run(
    body.title, JSON.stringify(body.specialities), JSON.stringify(body.languages), body.experienceYears,
    body.qualifications ?? null, body.about, body.approach ?? null, body.feeInr, body.sessionMinutes,
    JSON.stringify([...new Set(body.workingDays)].sort()), JSON.stringify(slotTimes), req.user.id,
  );
  res.json({ therapist: toTherapist(findTherapistByUser(req.user.id), { includeEmail: true }) });
}));

router.get('/:id', handle((req, res) => {
  const row = findTherapist(Number(req.params.id));
  if (!row || row.status !== 'approved') throw notFound('Therapist not found.');
  res.json({ therapist: toTherapist(row) });
}));

router.get('/:id/slots', handle((req, res) => {
  const row = findTherapist(Number(req.params.id));
  if (!row || row.status !== 'approved') throw notFound('Therapist not found.');
  res.json({ timezone: 'Asia/Kolkata', days: generateSlots(scheduleOf(row), takenStarts(row.id)) });
}));

export default router;
