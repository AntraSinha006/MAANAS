// End-to-end API test against a throwaway database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maanas-test-'));
process.env.DB_FILE = path.join(tmpDir, 'test.db');
process.env.OTP_MOCK = 'true';

const { migrate, db } = await import('../src/db.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { createApp } = await import('../src/app.js');

let server;
let base;
const quietLog = console.log;

before(async () => {
  console.log = () => {};
  migrate();
  seedIfEmpty();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  console.log = quietLog;
  server?.close();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token;

test('signup → OTP verify → assessment → recommended → book → chat → therapist accepts', async () => {
  const signup = await call('POST', '/auth/signup', { name: 'Test User', email: 'test@example.com', password: 'password123', language: 'Hindi' });
  assert.equal(signup.status, 201);
  assert.match(signup.data.devCode, /^\d{6}$/);

  const blocked = await call('POST', '/auth/login', { email: 'test@example.com', password: 'password123' });
  assert.equal(blocked.status, 403);

  const wrong = await call('POST', '/auth/verify-otp', { email: 'test@example.com', code: signup.data.devCode === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);

  const verified = await call('POST', '/auth/verify-otp', { email: 'test@example.com', code: blocked.data.error.details.devCode });
  assert.equal(verified.status, 200);
  const token = verified.data.token;

  const q = await call('GET', '/assessments/questions');
  const answers = {};
  for (const s of q.data.sections) for (const i of s.items) answers[i.id] = s.key === 'overthinking' ? 3 : 1;
  const assessment = await call('POST', '/assessments', { answers, focusTask: { trials: 10, correct: 8, avgReactionMs: 950 } }, token);
  assert.equal(assessment.status, 201);
  assert.equal(assessment.data.assessment.recommended[0], 'overthinking');
  assert.equal(assessment.data.assessment.crisisFlag, false);

  const rec = await call('GET', '/therapists/recommended', null, token);
  assert.ok(rec.data.therapists[0].specialities.includes('overthinking'));

  const aanya = (await call('GET', '/therapists?q=aanya')).data.therapists[0];
  const slots = await call('GET', `/therapists/${aanya.id}/slots`);
  const slot = slots.data.days.flatMap((d) => d.slots).find((s) => s.available);

  const booking = await call('POST', '/bookings', { therapistId: aanya.id, startAt: slot.startAt, mode: 'video', shareAssessment: true }, token);
  assert.equal(booking.status, 201);
  assert.equal(booking.data.booking.status, 'requested');

  const otherToken = await login('demo@maanas.app', 'demo1234');
  const clash = await call('POST', '/bookings', { therapistId: aanya.id, startAt: slot.startAt }, otherToken);
  assert.equal(clash.status, 409);

  const id = booking.data.booking.id;
  await call('POST', `/bookings/${id}/messages`, { body: 'Hello, looking forward to talking.' }, token);

  const tToken = await login('aanya@maanas.app', 'therapist123');
  const detail = await call('GET', `/bookings/${id}`, null, tToken);
  assert.equal(detail.data.booking.assessment.recommended[0], 'overthinking');
  const msgs = await call('GET', `/bookings/${id}/messages`, null, tToken);
  assert.equal(msgs.data.messages.length, 1);
  assert.equal(msgs.data.messages[0].mine, false);

  const accepted = await call('POST', `/bookings/${id}/respond`, { action: 'accept' }, tToken);
  assert.equal(accepted.data.booking.status, 'confirmed');

  // Another user can't see this booking.
  const peek = await call('GET', `/bookings/${id}`, null, otherToken);
  assert.equal(peek.status, 404);
});

test('concurrent bookings of the same slot: exactly one succeeds', async () => {
  const token = await login('demo@maanas.app', 'demo1234');
  const rohan = (await call('GET', '/therapists?q=rohan')).data.therapists[0];
  const slot = (await call('GET', `/therapists/${rohan.id}/slots`)).data.days.flatMap((d) => d.slots).filter((s) => s.available)[0];

  const signupAndVerify = async (email) => {
    const s = await call('POST', '/auth/signup', { name: 'Racer', email, password: 'password123' });
    return (await call('POST', '/auth/verify-otp', { email, code: s.data.devCode })).data.token;
  };
  const token2 = await signupAndVerify('racer@example.com');
  const results = await Promise.all([
    call('POST', '/bookings', { therapistId: rohan.id, startAt: slot.startAt }, token),
    call('POST', '/bookings', { therapistId: rohan.id, startAt: slot.startAt }, token2),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});

test('roles are enforced', async () => {
  const userToken = await login('demo@maanas.app', 'demo1234');
  assert.equal((await call('GET', '/admin/stats', null, userToken)).status, 403);
  assert.equal((await call('GET', '/bookings')).status, 401);
  const adminToken = await login('admin@maanas.app', 'admin1234');
  const stats = await call('GET', '/admin/stats', null, adminToken);
  assert.equal(stats.status, 200);
  assert.equal(stats.data.pendingTherapists, 1);
});
