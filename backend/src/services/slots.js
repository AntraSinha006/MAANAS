import { config } from '../config.js';

const OFFSET_MS = config.istOffsetMinutes * 60 * 1000;
export const BOOKING_WINDOW_DAYS = 14;
const MIN_LEAD_MS = 60 * 60 * 1000; // a slot must be at least 1 hour away

/** 'YYYY-MM-DD' + 'HH:MM' in India time → UTC ISO string. */
export function istToUtcIso(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_MS).toISOString();
}

/** The India-time calendar date for a JS Date, as 'YYYY-MM-DD'. */
export function istDateString(date) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

function istWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Builds the bookable slot list for a therapist.
 * @param {{working_days:number[], slot_times:string[]}} schedule
 * @param {Set<string>} takenStarts UTC ISO strings already held by active bookings
 */
export function generateSlots(schedule, takenStarts, now = new Date(), days = BOOKING_WINDOW_DAYS) {
  const today = istDateString(now);
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    if (!schedule.working_days.includes(istWeekday(date))) continue;
    const times = schedule.slot_times.map((time) => {
      const startAt = istToUtcIso(date, time);
      const tooSoon = new Date(startAt).getTime() - now.getTime() < MIN_LEAD_MS;
      return { time, startAt, available: !tooSoon && !takenStarts.has(startAt) };
    });
    result.push({ date, weekday: istWeekday(date), slots: times });
  }
  return result;
}

/** True when startAt is one of the therapist's generated slots and still bookable. */
export function isValidSlot(schedule, startAt, now = new Date()) {
  return generateSlots(schedule, new Set(), now).some((day) =>
    day.slots.some((slot) => slot.startAt === startAt && slot.available),
  );
}
