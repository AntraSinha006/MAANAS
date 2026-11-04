export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function esc(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = path;
}

const TZ = 'Asia/Kolkata';
export const fmt = {
  dateTime: (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
  date: (iso) => new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }),
  dayLabel: (dateStr) => new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }),
  time: (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
  hm: (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  },
  inr: (n) => `₹${Number(n).toLocaleString('en-IN')}`,
};

export const MOODS = [
  { id: 'great', label: 'Great', emoji: '😄' },
  { id: 'okay', label: 'Okay', emoji: '🙂' },
  { id: 'low', label: 'Low', emoji: '😔' },
  { id: 'anxious', label: 'Anxious', emoji: '😟' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
];

export const STATUS_LABELS = {
  requested: 'Awaiting therapist',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function statusPill(status) {
  return `<span class="pill status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;
}

export function loading(text = 'Loading…') {
  return `<div class="container"><div class="loading"><span class="spinner"></span>${esc(text)}</div></div>`;
}

export function errorView(error) {
  return `<div class="container"><div class="panel empty-state"><h3>Something went wrong</h3><p class="muted">${esc(error.message)}</p><a class="btn btn-secondary" href="#/">Go home</a></div></div>`;
}

export function avatar(initials, size = '') {
  return `<div class="consultant-avatar ${size}">${esc(initials)}</div>`;
}

export function crisisBox(resources) {
  if (!resources?.length) return '';
  return `<section class="crisis-box" role="alert">
    <h3>You don't have to face this alone</h3>
    <p>You mentioned thoughts of not being here or hurting yourself. Please reach out to someone right now — talking helps, and support is available 24×7.</p>
    <ul>${resources.map((r) => `<li><strong>${esc(r.name)}</strong> — call <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.alt ? ` or <a href="tel:${esc(r.alt)}">${esc(r.alt)}</a>` : ''}</li>`).join('')}</ul>
    <p class="muted" style="margin:0">If you are in immediate danger, please call 112 or go to the nearest hospital.</p>
  </section>`;
}

/** Simple dependency-free bar used for scores. strain 0..1 */
export function strainBar(strain) {
  const pct = Math.round(strain * 100);
  const level = strain < 0.25 ? 'low' : strain < 0.5 ? 'mild' : strain < 0.75 ? 'moderate' : 'high';
  return `<div class="strain-track" role="img" aria-label="${pct}% strain"><span class="strain-fill level-${level}" style="width:${Math.max(pct, 3)}%"></span></div>`;
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = text || 'Please wait…';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}
