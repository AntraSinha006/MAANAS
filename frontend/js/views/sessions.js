import { api, session } from '../api.js';
import { $, esc, fmt, navigate, statusPill, toast, setBusy } from '../ui.js';
import { resultCard } from './assessment.js';

const ACTIVE = ['requested', 'confirmed'];
const JOIN_EARLY_MS = 15 * 60 * 1000;

export function bookingRow(b) {
  const isTherapist = session.user.role === 'therapist';
  const who = isTherapist ? b.client.name : b.therapist.name;
  return `<a class="history-item link-row booking-row" href="#/session/${b.id}">
    <span><strong>${esc(who)}</strong>${isTherapist ? '' : ` <small class="muted">${esc(b.therapist.title)}</small>`}<br>
      <small class="muted">${esc(fmt.dateTime(b.startAt))} IST · ${b.durationMin} min · ${b.mode === 'video' ? '🎥 Video' : '💬 Chat'}${b.messagesFromOther ? ` · ${b.messagesFromOther} message${b.messagesFromOther > 1 ? 's' : ''}` : ''}</small></span>
    <span class="row-end">${statusPill(b.status)}${!isTherapist && ACTIVE.includes(b.status) ? `<span class="pill ${b.paymentStatus === 'paid' ? 'status-confirmed' : ''}">${b.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</span>` : ''}</span>
  </a>`;
}

export async function bookingsView() {
  const { bookings } = await api('/bookings');
  const now = Date.now();
  const upcoming = bookings.filter((b) => ACTIVE.includes(b.status) && new Date(b.startAt).getTime() + b.durationMin * 60000 > now);
  const past = bookings.filter((b) => !upcoming.includes(b)).reverse();
  const isTherapist = session.user.role === 'therapist';
  return `<div class="container">
    <div class="page-heading"><div class="eyebrow">${isTherapist ? 'Your practice' : 'Your support'}</div><h1>${isTherapist ? 'Client sessions' : 'My sessions'}</h1></div>
    <section class="panel"><h3 style="margin-top:0">Upcoming</h3>
      ${upcoming.length ? upcoming.map(bookingRow).join('') : `<div class="empty-state">No upcoming sessions.${isTherapist ? '' : '<br><br><a class="btn btn-primary" href="#/therapists">Find a therapist</a>'}</div>`}
    </section>
    ${past.length ? `<section class="panel" style="margin-top:18px"><h3 style="margin-top:0">Past & cancelled</h3>${past.map(bookingRow).join('')}</section>` : ''}
  </div>`;
}

export async function sessionView({ params }) {
  const id = Number(params[0]);
  const { booking: b, therapist } = await api(`/bookings/${id}`);
  const isTherapist = session.user.role === 'therapist';
  const start = new Date(b.startAt).getTime();
  const canJoin = b.status === 'confirmed' && b.mode === 'video' && Date.now() >= start - JOIN_EARLY_MS && Date.now() <= start + b.durationMin * 60000;
  const chatOpen = ACTIVE.includes(b.status);
  const counterpart = isTherapist ? b.client.name : b.therapist.name;
  const videoUrl = b.roomCode ? `https://meet.jit.si/MAANAS-${encodeURIComponent(b.roomCode)}` : null;

  const actions = [];
  if (!isTherapist && ACTIVE.includes(b.status) && b.paymentStatus !== 'paid') actions.push(`<button class="btn btn-primary" id="pay-btn">Pay ${esc(fmt.inr(b.feeInr))} (demo)</button>`);
  if (isTherapist && b.status === 'requested') actions.push('<button class="btn btn-primary" data-respond="accept">Accept request</button><button class="btn btn-secondary" data-respond="decline">Decline</button>');
  if (isTherapist && b.status === 'confirmed') actions.push('<button class="btn btn-secondary" id="complete-btn">Mark session completed</button>');
  if (ACTIVE.includes(b.status)) actions.push('<button class="btn btn-quiet clear-moods" id="cancel-btn">Cancel session</button>');

  const videoBlock = b.mode === 'video' && videoUrl && ACTIVE.includes(b.status)
    ? `<div class="video-card"><div><strong>🎥 Video room</strong><br><small class="muted">${b.status === 'requested' ? 'Opens once the therapist confirms.' : canJoin ? 'Your room is open now.' : 'Opens 15 minutes before the session.'}</small></div>
        ${b.status === 'confirmed' ? `<a class="btn ${canJoin ? 'btn-primary' : 'btn-secondary'}" href="${videoUrl}" target="_blank" rel="noopener" id="join-btn">${canJoin ? 'Join video call' : 'Test video room'}</a>` : ''}</div>`
    : '';

  return {
    html: `<div class="container"><a class="text-link" href="#/bookings">← All sessions</a>
      <div class="session-layout">
        <section class="panel">
          <div class="summary-heading"><div><div class="eyebrow">Session with</div><h2 class="section-title" style="margin:6px 0 0">${esc(counterpart)}</h2></div>${statusPill(b.status)}</div>
          <div class="history-item"><span class="muted">When</span><strong>${esc(fmt.dateTime(b.startAt))} IST</strong></div>
          <div class="history-item"><span class="muted">Length</span><strong>${b.durationMin} min · ${b.mode === 'video' ? 'Video call' : 'Chat'}</strong></div>
          <div class="history-item"><span class="muted">Fee</span><strong>${esc(fmt.inr(b.feeInr))} · ${esc(b.paymentStatus)}</strong></div>
          ${isTherapist ? `<div class="history-item"><span class="muted">Client</span><strong>${esc(b.client.name)}${b.client.ageGroup ? ` · ${esc(b.client.ageGroup)}` : ''} · ${esc(b.client.language || '')}</strong></div>` : ''}
          ${b.note ? `<div class="history-item"><span class="muted">${isTherapist ? 'Client note' : 'Your note'}</span><span>${esc(b.note)}</span></div>` : ''}
          ${videoBlock}
          <div class="actions">${actions.join('')}</div>
          ${isTherapist ? `<div class="field" style="margin-top:20px"><label for="t-notes">Private session notes (only you can see these)</label><textarea id="t-notes" rows="4" maxlength="2000">${esc(b.therapistNotes || '')}</textarea><button class="btn btn-secondary" id="save-notes" style="margin-top:8px">Save notes</button></div>` : ''}
          ${isTherapist && b.assessment ? `<details class="shared-assessment" open><summary>Mind-check summary shared by client</summary>${resultCard(b.assessment)}${b.assessment.crisisFlag ? '<div class="crisis-box"><strong>Safety flag:</strong> the client indicated thoughts of self-harm on this check. Please prioritise a safety check-in.</div>' : ''}</details>` : ''}
          ${isTherapist && !b.assessment ? '<p class="muted" style="font-size:12px">The client did not share a mind-check summary.</p>' : ''}
          ${!isTherapist && therapist ? `<p class="muted" style="font-size:12px;margin-top:18px">${b.sharedAssessment ? 'You shared your latest mind-check summary with your therapist.' : 'You did not share a mind-check summary.'}</p>` : ''}
        </section>

        <section class="panel chat-panel">
          <div class="summary-heading"><h3 style="margin:0">Messages</h3><small class="muted">${chatOpen ? 'Updates automatically' : 'Chat closed'}</small></div>
          <div class="chat-log" id="chat-log" aria-live="polite"><div class="loading"><span class="spinner"></span></div></div>
          ${chatOpen ? `<form class="chat-form" id="chat-form"><textarea id="chat-input" rows="2" maxlength="2000" placeholder="Write a message…" required></textarea><button class="btn btn-primary" type="submit">Send</button></form>` : ''}
          <p class="muted" style="font-size:11px;margin:8px 0 0">Messages are for session logistics and check-ins. In an emergency call 112 or Tele-MANAS 14416.</p>
        </section>
      </div></div>`,
    mount(root) {
      const log = $('#chat-log', root);
      let lastId = 0;
      let first = true;

      const append = (messages) => {
        if (first) { log.innerHTML = ''; first = false; }
        if (!messages.length && !log.children.length) log.innerHTML = `<p class="muted chat-empty">No messages yet. Say hello to ${esc(counterpart)}.</p>`;
        for (const m of messages) {
          log.querySelector('.chat-empty')?.remove();
          lastId = Math.max(lastId, m.id);
          log.insertAdjacentHTML('beforeend', `<div class="bubble ${m.mine ? 'mine' : ''}"><p>${esc(m.body)}</p><small>${esc(m.mine ? 'You' : m.senderName)} · ${esc(fmt.time(m.createdAt))}</small></div>`);
        }
        if (messages.length) log.scrollTop = log.scrollHeight;
      };
      const poll = async () => {
        try {
          const res = await api(`/bookings/${id}/messages`, { query: { after: lastId } });
          append(res.messages);
        } catch { /* transient; next poll retries */ }
      };
      poll();
      const timer = chatOpen ? setInterval(poll, 3000) : null;

      $('#chat-form', root)?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = $('#chat-input', root);
        const body = input.value.trim();
        if (!body) return;
        input.value = '';
        try {
          await api(`/bookings/${id}/messages`, { method: 'POST', body: { body } });
          poll();
        } catch (error) {
          input.value = body;
          toast(error.message);
        }
      });
      $('#chat-input', root)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat-form', root).requestSubmit(); }
      });

      const act = async (button, path, body, message) => {
        setBusy(button, true);
        try {
          await api(path, { method: 'POST', body });
          toast(message);
          navigate(`/session/${id}`);
        } catch (error) {
          toast(error.message);
          setBusy(button, false);
        }
      };
      $('#pay-btn', root)?.addEventListener('click', (e) => act(e.currentTarget, `/bookings/${id}/pay`, {}, 'Payment successful (demo — no money was charged).'));
      root.querySelectorAll('[data-respond]').forEach((btn) => btn.addEventListener('click', (e) => act(e.currentTarget, `/bookings/${id}/respond`, { action: btn.dataset.respond }, btn.dataset.respond === 'accept' ? 'Session confirmed.' : 'Request declined.')));
      $('#complete-btn', root)?.addEventListener('click', (e) => act(e.currentTarget, `/bookings/${id}/complete`, { notes: $('#t-notes', root)?.value || undefined }, 'Session marked completed.'));
      $('#cancel-btn', root)?.addEventListener('click', (e) => {
        if (!window.confirm('Cancel this session? Any demo payment will be marked refunded.')) return;
        act(e.currentTarget, `/bookings/${id}/cancel`, {}, 'Session cancelled.');
      });
      $('#save-notes', root)?.addEventListener('click', async () => {
        try {
          await api(`/bookings/${id}/notes`, { method: 'PUT', body: { notes: $('#t-notes', root).value } });
          toast('Notes saved.');
        } catch (error) {
          toast(error.message);
        }
      });

      return () => clearInterval(timer);
    },
  };
}
