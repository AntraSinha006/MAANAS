import { api, session } from '../api.js';
import { $, $$, esc, fmt, navigate, setBusy, toast } from '../ui.js';

function card(t) {
  return `<article class="consultant-card">
    <div class="consultant-top"><div class="consultant-avatar">${esc(t.initials)}</div>
      <div><h3>${esc(t.name)}</h3><div class="consultant-speciality">${esc(t.title)}</div><div class="muted" style="font-size:11px;margin-top:4px">${t.experienceYears} years of experience</div></div></div>
    <p>${esc(t.about)}</p>
    <div class="tag-row">${t.specialityLabels.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</div>
    ${t.matchReasons?.length ? `<div class="tag-row">${t.matchReasons.map((r) => `<span class="tag tag-match">✓ ${esc(r)}</span>`).join('')}</div>` : ''}
    <p class="consultant-meta">${t.languages.map(esc).join(' · ')} — ${esc(fmt.inr(t.feeInr))} / ${t.sessionMinutes} min</p>
    <a class="btn btn-primary" href="#/therapists/${t.id}">View profile & book</a>
  </article>`;
}

export async function directoryView({ query }) {
  const isUser = session.user?.role === 'user';
  const [{ specialities }, { languages }, rec] = await Promise.all([
    api('/therapists/specialities'),
    api('/auth/options'),
    isUser ? api('/therapists/recommended') : Promise.resolve(null),
  ]);
  const initial = { q: query.get('q') || '', speciality: query.get('speciality') || '', language: '' };

  return {
    html: `<div class="container">
      <div class="page-heading"><div class="eyebrow">Real people, ready to listen</div><h1>Find a therapist</h1>
        <p>Every therapist is reviewed by MAANAS before appearing here. Sessions happen over secure chat and video. <em>(Profiles in this prototype are fictional.)</em></p></div>
      ${rec?.basedOn ? `<section class="panel recommend-panel"><div class="eyebrow">Recommended for you</div>
        <p class="muted" style="margin:6px 0 16px">Based on your mind check from ${esc(fmt.date(rec.basedOn.createdAt))}${rec.basedOn.recommendedLabels.length ? ` — ${esc(rec.basedOn.recommendedLabels.join(', '))}` : ''}.</p>
        <div class="consultant-grid">${rec.therapists.slice(0, 3).map(card).join('')}</div></section>`
        : isUser ? `<div class="notice">Tip: <a class="text-link" href="#/assessment">take the mind check</a> and we'll suggest therapists who fit what you're going through.</div>` : ''}
      <div class="consultant-toolbar">
        <input class="search-input" id="t-search" type="search" placeholder="Search name, approach…" aria-label="Search therapists" value="${esc(initial.q)}">
        <select class="filter-select" id="t-spec" aria-label="Speciality"><option value="">All specialities</option>${specialities.map((s) => `<option value="${s.key}" ${initial.speciality === s.key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
        <select class="filter-select" id="t-lang" aria-label="Language"><option value="">Any language</option>${languages.map((l) => `<option>${esc(l)}</option>`).join('')}</select>
      </div>
      <div class="consultant-grid" id="t-results"><div class="loading"><span class="spinner"></span>Loading…</div></div>
    </div>`,
    mount(root) {
      const search = $('#t-search', root);
      const spec = $('#t-spec', root);
      const lang = $('#t-lang', root);
      let timer;
      const load = async () => {
        try {
          const { therapists } = await api('/therapists', { query: { q: search.value.trim(), speciality: spec.value, language: lang.value } });
          $('#t-results', root).innerHTML = therapists.length ? therapists.map(card).join('') : '<div class="empty-state">No therapists match. Try another filter.</div>';
        } catch (error) {
          toast(error.message);
        }
      };
      search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
      spec.addEventListener('change', load);
      lang.addEventListener('change', load);
      load();
      return () => clearTimeout(timer);
    },
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function profileView({ params }) {
  const id = Number(params[0]);
  const [{ therapist: t }, { days }] = await Promise.all([api(`/therapists/${id}`), api(`/therapists/${id}/slots`)]);
  const role = session.user?.role;
  const hasAssessment = role === 'user' ? (await api('/assessments')).assessments.length > 0 : false;
  const openDays = days.filter((d) => d.slots.some((s) => s.available));
  const state = { date: openDays[0]?.date, startAt: null, mode: 'video' };

  const bookingPanel = role === 'user'
    ? `<form id="book-form">
        <div class="field"><label>1. Choose a day <small class="muted">(times in IST)</small></label>
          <div class="day-strip">${days.map((d) => {
            const open = d.slots.some((s) => s.available);
            return `<button type="button" class="day-chip" data-date="${d.date}" ${open ? '' : 'disabled'}>${esc(fmt.dayLabel(d.date))}<small>${d.slots.filter((s) => s.available).length} open</small></button>`;
          }).join('')}</div></div>
        <div class="field"><label>2. Choose a time</label><div class="slot-grid" id="slot-grid"></div></div>
        <div class="field"><label>3. How would you like to talk?</label>
          <div class="segmented"><label><input type="radio" name="mode" value="video" checked><span>🎥 Video call</span></label><label><input type="radio" name="mode" value="chat"><span>💬 Chat only</span></label></div></div>
        <div class="field"><label for="b-note">What would you like to talk about? (optional)</label><textarea id="b-note" rows="3" maxlength="500" placeholder="Only share what you're comfortable sharing"></textarea></div>
        <label class="consent"><input type="checkbox" id="b-share" ${hasAssessment ? 'checked' : 'disabled'}> Share my latest mind-check summary with ${esc(t.name)} ${hasAssessment ? '' : '<small class="muted">(take the mind check first)</small>'}</label>
        <div class="booking-summary" id="b-summary">Pick a time to continue.</div>
        <button class="btn btn-primary full" type="submit" id="b-submit" disabled>Request session</button>
      </form>`
    : role
      ? '<div class="notice">Only client accounts can book sessions.</div>'
      : `<div class="notice">Log in or create a free account to book a session.</div><div class="actions"><a class="btn btn-primary" href="#/login?next=/therapists/${t.id}">Log in to book</a><a class="btn btn-secondary" href="#/signup">Create account</a></div>`;

  return {
    html: `<div class="container"><a class="text-link" href="#/therapists">← All therapists</a>
      <div class="profile-layout" style="margin-top:18px">
        <section class="panel profile-intro">
          <div class="consultant-avatar">${esc(t.initials)}</div><h2>${esc(t.name)}</h2>
          <span class="consultant-speciality">${esc(t.title)}</span>
          <p class="muted" style="font-size:12px">${t.experienceYears} years · ${esc(t.qualifications || '')}</p>
          <div class="tag-row" style="justify-content:center">${t.specialityLabels.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</div>
          <p>${esc(t.about)}</p>
          ${t.approach ? `<p class="consultant-meta"><strong>Approach:</strong> ${esc(t.approach)}</p>` : ''}
          <div class="profile-facts"><div><strong>${esc(fmt.inr(t.feeInr))}</strong><small>per session</small></div><div><strong>${t.sessionMinutes} min</strong><small>session</small></div><div><strong>${t.languages.length}</strong><small>${t.languages.map(esc).join(', ')}</small></div></div>
          <p class="muted" style="font-size:12px">Available ${t.workingDays.map((d) => WEEKDAYS[d]).join(', ')}</p>
        </section>
        <section class="panel"><div class="eyebrow">Book a session</div><h2 class="section-title" style="font-size:25px;margin-top:8px">Request a time</h2>
          <p class="muted" style="font-size:13px">${esc(t.name)} will confirm your request. You can chat before the session and cancel any time before it starts.</p>
          ${bookingPanel}
        </section>
      </div></div>`,
    mount(root) {
      const form = $('#book-form', root);
      if (!form) return;
      const grid = $('#slot-grid', root);
      const summary = $('#b-summary', root);
      const submit = $('#b-submit', root);

      const renderSlots = () => {
        $$('.day-chip', root).forEach((c) => c.classList.toggle('selected', c.dataset.date === state.date));
        const day = days.find((d) => d.date === state.date);
        grid.innerHTML = day
          ? day.slots.map((s) => `<button type="button" class="slot ${state.startAt === s.startAt ? 'selected' : ''}" data-start="${s.startAt}" ${s.available ? '' : 'disabled'}>${esc(fmt.hm(s.time))}</button>`).join('')
          : '<p class="muted">No open slots in the next two weeks.</p>';
        $$('[data-start]', grid).forEach((b) => b.addEventListener('click', () => { state.startAt = b.dataset.start; renderSlots(); }));
        submit.disabled = !state.startAt;
        summary.innerHTML = state.startAt
          ? `<strong>${esc(fmt.dateTime(state.startAt))}</strong> IST · ${t.sessionMinutes} min · ${esc(fmt.inr(t.feeInr))}`
          : 'Pick a time to continue.';
      };
      $$('.day-chip', root).forEach((c) => c.addEventListener('click', () => { state.date = c.dataset.date; state.startAt = null; renderSlots(); }));
      renderSlots();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.startAt) return toast('Please choose a time.');
        setBusy(submit, true, 'Requesting…');
        try {
          const { booking } = await api('/bookings', {
            method: 'POST',
            body: { therapistId: t.id, startAt: state.startAt, mode: form.mode.value, note: $('#b-note', root).value.trim() || undefined, shareAssessment: $('#b-share', root).checked },
          });
          toast('Session requested! You can pay and chat from the session page.');
          navigate(`/session/${booking.id}`);
        } catch (error) {
          toast(error.message);
          setBusy(submit, false);
          if (error.status === 409) navigate(`/therapists/${t.id}`);
        }
      });
    },
  };
}
