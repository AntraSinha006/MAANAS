import crypto from 'node:crypto';
import { Router } from 'express';
import { db, nowIso, transaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { badRequest, conflict, forbidden, handle, notFound } from '../errors.js';
import { validate } from '../validate.js';
import { isValidSlot } from '../services/slots.js';
import { findTherapist, findTherapistByUser, scheduleOf, toTherapist } from '../services/therapistRepo.js';
import { toAssessment } from './assessments.js';

const router = Router();
const ACTIVE = ['requested', 'confirmed'];

const BOOKING_SELECT = `
  SELECT b.*, cu.name AS client_name, cu.email AS client_email, cu.language AS client_language, cu.age_group AS client_age_group,
         tu.name AS therapist_name, t.title AS therapist_title, t.user_id AS therapist_user_id
  FROM bookings b
  JOIN users cu ON cu.id = b.user_id
  JOIN therapists t ON t.id = b.therapist_id
  JOIN users tu ON tu.id = t.user_id
`;

function toBooking(row, viewer) {
  const isTherapist = viewer.role === 'therapist';
  const unread = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE booking_id = ? AND sender_id != ?').get(row.id, viewer.id).n;
  return {
    id: row.id,
    startAt: row.start_at,
    durationMin: row.duration_min,
    mode: row.mode,
    status: row.status,
    note: row.note,
    feeInr: row.fee_inr,
    paymentStatus: row.payment_status,
    roomCode: ACTIVE.includes(row.status) || row.status === 'completed' ? row.room_code : null,
    sharedAssessment: !!row.assessment_id,
    createdAt: row.created_at,
    messagesFromOther: Number(unread),
    therapist: { id: row.therapist_id, name: row.therapist_name, title: row.therapist_title },
    client: isTherapist
      ? { id: row.user_id, name: row.client_name, language: row.client_language, ageGroup: row.client_age_group }
      : undefined,
    therapistNotes: isTherapist ? row.therapist_notes : undefined,
  };
}

/** Loads a booking and checks the viewer is the client or the therapist on it. */
function loadForParticipant(id, user) {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id);
  if (!row) throw notFound('Booking not found.');
  const isClient = row.user_id === user.id;
  const isTherapist = row.therapist_user_id === user.id;
  if (!isClient && !isTherapist) throw notFound('Booking not found.');
  return { row, isClient, isTherapist };
}

router.use(requireAuth);

router.post('/', requireRole('user'), handle((req, res) => {
  const body = validate(req.body, {
    therapistId: { type: 'int', required: true, min: 1 },
    startAt: { type: 'string', required: true, max: 40 },
    mode: { type: 'string', enum: ['video', 'chat'], default: 'video' },
    note: { type: 'string', max: 500 },
    shareAssessment: { type: 'bool', default: false },
  });
  const therapist = findTherapist(body.therapistId);
  if (!therapist || therapist.status !== 'approved') throw notFound('Therapist not found.');

  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) throw badRequest('startAt must be a valid date.');
  const startIso = startAt.toISOString();
  if (!isValidSlot(scheduleOf(therapist), startIso)) throw badRequest('That time is not an open slot for this therapist.');

  const clash = db.prepare(`SELECT 1 FROM bookings WHERE user_id = ? AND start_at = ? AND status IN ('requested','confirmed')`).get(req.user.id, startIso);
  if (clash) throw conflict('You already have a session at this time.');

  let assessmentId = null;
  if (body.shareAssessment) {
    assessmentId = db.prepare('SELECT id FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id)?.id ?? null;
  }

  let bookingId;
  try {
    bookingId = transaction(() => db.prepare(`
      INSERT INTO bookings (user_id, therapist_id, start_at, duration_min, mode, note, assessment_id, fee_inr, room_code)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      req.user.id, therapist.id, startIso, therapist.session_minutes, body.mode, body.note ?? null,
      assessmentId, therapist.fee_inr, crypto.randomBytes(9).toString('base64url'),
    ).lastInsertRowid);
  } catch (error) {
    // The partial unique index guarantees one active booking per therapist slot, even under races.
    if (String(error.message).includes('UNIQUE')) throw conflict('Sorry — someone just booked this slot. Please pick another time.');
    throw error;
  }

  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId);
  res.status(201).json({ booking: toBooking(row, req.user) });
}));

router.get('/', handle((req, res) => {
  let rows;
  if (req.user.role === 'therapist') {
    const therapist = findTherapistByUser(req.user.id);
    rows = therapist ? db.prepare(`${BOOKING_SELECT} WHERE b.therapist_id = ? ORDER BY b.start_at ASC`).all(therapist.id) : [];
  } else {
    rows = db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.start_at ASC`).all(req.user.id);
  }
  res.json({ bookings: rows.map((row) => toBooking(row, req.user)) });
}));

router.get('/:id', handle((req, res) => {
  const { row, isTherapist } = loadForParticipant(Number(req.params.id), req.user);
  const booking = toBooking(row, req.user);
  if (isTherapist && row.assessment_id) {
    booking.assessment = toAssessment(db.prepare('SELECT * FROM assessments WHERE id = ?').get(row.assessment_id));
  }
  const therapist = toTherapist(findTherapist(row.therapist_id));
  res.json({ booking, therapist });
}));

// Mock payment gateway — replace with Razorpay/Stripe order + webhook in production.
router.post('/:id/pay', requireRole('user'), handle((req, res) => {
  const { row, isClient } = loadForParticipant(Number(req.params.id), req.user);
  if (!isClient) throw forbidden();
  if (!ACTIVE.includes(row.status)) throw badRequest('Only upcoming sessions can be paid for.');
  if (row.payment_status === 'paid') throw conflict('This session is already paid.');
  db.prepare(`UPDATE bookings SET payment_status = 'paid', updated_at = ? WHERE id = ?`).run(nowIso(), row.id);
  res.json({ booking: toBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(row.id), req.user), receipt: `DEMO-${row.id}-${Date.now()}` });
}));

router.post('/:id/cancel', handle((req, res) => {
  const { row } = loadForParticipant(Number(req.params.id), req.user);
  if (!ACTIVE.includes(row.status)) throw badRequest('This session can no longer be cancelled.');
  const payment = row.payment_status === 'paid' ? 'refunded' : row.payment_status;
  db.prepare(`UPDATE bookings SET status = 'cancelled', payment_status = ?, updated_at = ? WHERE id = ?`).run(payment, nowIso(), row.id);
  res.json({ booking: toBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(row.id), req.user) });
}));

router.post('/:id/respond', requireRole('therapist'), handle((req, res) => {
  const { action } = validate(req.body, { action: { type: 'string', required: true, enum: ['accept', 'decline'] } });
  const { row, isTherapist } = loadForParticipant(Number(req.params.id), req.user);
  if (!isTherapist) throw forbidden();
  if (row.status !== 'requested') throw badRequest('Only new requests can be accepted or declined.');
  const status = action === 'accept' ? 'confirmed' : 'declined';
  const payment = status === 'declined' && row.payment_status === 'paid' ? 'refunded' : row.payment_status;
  db.prepare('UPDATE bookings SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?').run(status, payment, nowIso(), row.id);
  res.json({ booking: toBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(row.id), req.user) });
}));

router.post('/:id/complete', requireRole('therapist'), handle((req, res) => {
  const { notes } = validate(req.body, { notes: { type: 'string', max: 2000 } });
  const { row, isTherapist } = loadForParticipant(Number(req.params.id), req.user);
  if (!isTherapist) throw forbidden();
  if (row.status !== 'confirmed') throw badRequest('Only confirmed sessions can be marked complete.');
  db.prepare(`UPDATE bookings SET status = 'completed', therapist_notes = COALESCE(?, therapist_notes), updated_at = ? WHERE id = ?`)
    .run(notes ?? null, nowIso(), row.id);
  res.json({ booking: toBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(row.id), req.user) });
}));

router.put('/:id/notes', requireRole('therapist'), handle((req, res) => {
  const { notes } = validate(req.body, { notes: { type: 'string', max: 2000, default: '' } });
  const { row, isTherapist } = loadForParticipant(Number(req.params.id), req.user);
  if (!isTherapist) throw forbidden();
  db.prepare('UPDATE bookings SET therapist_notes = ?, updated_at = ? WHERE id = ?').run(notes, nowIso(), row.id);
  res.json({ ok: true });
}));

// ---- Session chat ----
router.get('/:id/messages', handle((req, res) => {
  const { row } = loadForParticipant(Number(req.params.id), req.user);
  const after = Number(req.query.after || 0);
  const messages = db.prepare(`
    SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name, u.role AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.booking_id = ? AND m.id > ? ORDER BY m.id ASC LIMIT 200
  `).all(row.id, after);
  res.json({
    status: row.status,
    messages: messages.map((m) => ({
      id: m.id, body: m.body, createdAt: m.created_at, senderName: m.sender_name, senderRole: m.sender_role, mine: m.sender_id === req.user.id,
    })),
  });
}));

router.post('/:id/messages', handle((req, res) => {
  const { body } = validate(req.body, { body: { type: 'string', required: true, min: 1, max: 2000 } });
  const { row } = loadForParticipant(Number(req.params.id), req.user);
  if (!ACTIVE.includes(row.status)) throw badRequest('Chat is closed for this session.');
  const info = db.prepare('INSERT INTO messages (booking_id, sender_id, body) VALUES (?,?,?)').run(row.id, req.user.id, body);
  res.status(201).json({ message: { id: Number(info.lastInsertRowid), body, mine: true, senderName: req.user.name, senderRole: req.user.role, createdAt: nowIso() } });
}));

export default router;
