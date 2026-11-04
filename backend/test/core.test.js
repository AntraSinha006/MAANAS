import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesModel, focusTaskStrain } from '../src/services/scoringModel.js';
import { SECTIONS } from '../src/services/questionBank.js';
import { generateSlots, istToUtcIso, isValidSlot } from '../src/services/slots.js';
import { rankTherapists } from '../src/services/matching.js';

const allItems = SECTIONS.flatMap((s) => s.items.map((i) => i.id));
const answerAll = (value, overrides = {}) => ({ ...Object.fromEntries(allItems.map((id) => [id, value])), ...overrides });

test('all-zero answers give a full wellbeing index and no recommendation', () => {
  const r = rulesModel.predict({ answers: answerAll(0) });
  assert.equal(r.wellbeingIndex, 100);
  assert.equal(r.overallBand, 'Thriving');
  assert.deepEqual(r.recommended, []);
  assert.equal(r.crisisFlag, false);
  assert.equal(r.suggestTherapist, false);
});

test('all-max answers give index 0 and suggest a therapist', () => {
  const r = rulesModel.predict({ answers: answerAll(3) });
  assert.equal(r.wellbeingIndex, 0);
  assert.equal(r.overallBand, 'Needs support');
  assert.equal(r.suggestTherapist, true);
  assert.equal(r.recommended.length, 3);
});

test('overthinking-heavy answers recommend overthinking first', () => {
  const r = rulesModel.predict({ answers: answerAll(0, { o1: 3, o2: 3, o3: 3, o4: 3, a1: 2, a2: 2, a3: 2, a4: 2 }) });
  assert.equal(r.recommended[0], 'overthinking');
  assert.ok(r.recommended.includes('anxiety'));
});

test('safety item raises crisis flag but does not change the index', () => {
  const base = rulesModel.predict({ answers: answerAll(1) });
  const flagged = rulesModel.predict({ answers: answerAll(1, { x1: 1 }) });
  assert.equal(flagged.crisisFlag, true);
  assert.equal(flagged.suggestTherapist, true);
  assert.equal(flagged.wellbeingIndex, base.wellbeingIndex);
});

test('focus task strain: perfect & fast = 0, all wrong & slow = 1', () => {
  assert.equal(focusTaskStrain({ trials: 10, correct: 10, avgReactionMs: 600 }), 0);
  assert.equal(focusTaskStrain({ trials: 10, correct: 0, avgReactionMs: 3000 }), 1);
  assert.equal(focusTaskStrain(null), null);
});

test('IST slot times convert to UTC (IST = UTC+5:30)', () => {
  assert.equal(istToUtcIso('2026-11-02', '10:00'), '2026-11-02T04:30:00.000Z');
  assert.equal(istToUtcIso('2026-11-02', '03:00'), '2026-11-01T21:30:00.000Z');
});

test('slot generator honours working days, taken slots and lead time', () => {
  const schedule = { working_days: [1], slot_times: ['10:00', '12:00'] }; // Mondays only
  const now = new Date('2026-11-02T05:00:00.000Z'); // Monday 10:30 IST
  const taken = new Set([istToUtcIso('2026-11-09', '10:00')]);
  const days = generateSlots(schedule, taken, now);
  assert.deepEqual(days.map((d) => d.date), ['2026-11-02', '2026-11-09']);
  const [today, next] = days;
  assert.equal(today.slots[0].available, false); // already past
  assert.equal(today.slots[1].available, true);  // 12:00 IST is 1.5h away
  assert.equal(next.slots[0].available, false);  // taken
  assert.equal(isValidSlot(schedule, istToUtcIso('2026-11-02', '12:00'), now), true);
  assert.equal(isValidSlot(schedule, istToUtcIso('2026-11-03', '12:00'), now), false); // Tuesday
});

test('matching ranks by recommended specialities then language', () => {
  const t = (id, specialities, languages) => ({ id, specialities, languages, experienceYears: 5 });
  const ranked = rankTherapists(
    [t(1, ['sleep'], ['English']), t(2, ['overthinking'], ['English']), t(3, ['overthinking'], ['Hindi'])],
    { recommended: ['overthinking', 'sleep'], language: 'Hindi' },
  );
  assert.deepEqual(ranked.map((r) => r.id), [3, 2, 1]);
  assert.ok(ranked[0].matchReasons.includes('Speaks Hindi'));
});
