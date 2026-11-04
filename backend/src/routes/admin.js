import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { handle, notFound } from '../errors.js';
import { validate } from '../validate.js';
import { findTherapist, listTherapists, toTherapist } from '../services/therapistRepo.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', handle((_req, res) => {
  const count = (sql) => Number(db.prepare(sql).get().n);
  res.json({
    users: count(`SELECT COUNT(*) n FROM users WHERE role = 'user'`),
    therapists: count(`SELECT COUNT(*) n FROM therapists WHERE status = 'approved'`),
    pendingTherapists: count(`SELECT COUNT(*) n FROM therapists WHERE status = 'pending'`),
    assessments: count('SELECT COUNT(*) n FROM assessments'),
    crisisFlags: count('SELECT COUNT(*) n FROM assessments WHERE crisis_flag = 1'),
    bookings: count('SELECT COUNT(*) n FROM bookings'),
    activeBookings: count(`SELECT COUNT(*) n FROM bookings WHERE status IN ('requested','confirmed')`),
    completedSessions: count(`SELECT COUNT(*) n FROM bookings WHERE status = 'completed'`),
    checkins: count('SELECT COUNT(*) n FROM checkins'),
  });
}));

router.get('/therapists', handle((_req, res) => {
  res.json({ therapists: listTherapists({ status: 'all' }).map((row) => toTherapist(row, { includeEmail: true })) });
}));

router.post('/therapists/:id/status', handle((req, res) => {
  const { status } = validate(req.body, { status: { type: 'string', required: true, enum: ['approved', 'rejected', 'pending'] } });
  const row = findTherapist(Number(req.params.id));
  if (!row) throw notFound('Therapist not found.');
  db.prepare('UPDATE therapists SET status = ? WHERE id = ?').run(status, row.id);
  res.json({ therapist: toTherapist(findTherapist(row.id), { includeEmail: true }) });
}));

export default router;
