import { api, session } from '../api.js';
import { logout } from '../app.js';
import { $, $$, MOODS, esc, fmt, navigate, setBusy, toast } from '../ui.js';
import { bookingRow } from './sessions.js';

// ---------------- Dashboards ----------------
export async function dashboardView() {
  const role = session.user.role;
  if (role === 'admin') return navigate('/admin') || '';
  if (role === 'therapist') return therapistDashboard();
  return userDashboard();
}

async function userDashboard() {
  const [{ assessments }, { checkins }, { bookings }] = await Promise.all([api('/assessments'), api('/checkins'), api('/bookings')]);
  const latest = assessments[0];
  const lastMood = MOODS.find((m) => m.id === checkins[0]?.mood);
  const upcoming = bookings.filter((b) => ['requested', 'confirmed'].includes(b.status) && new Date(b.startAt).getTime() + b.durationMin * 60000 > Date.now());
  return `<div class="container">
    <section class="dashboard-welcome"><div><div class="eyebrow">Your personal space</div><h1>Hi, ${esc(session.user.name.split(' ')[0])} 🌿</h1>
      <p class="muted" style="margin:0">There's no right or wrong way to feel. How are you arriving today?</p></div>
      <div class="actions"><a class="btn btn-primary" href="#/checkin">Daily check-in</a><a class="btn btn-secondary" href="#/assessment">${latest ? 'Retake mind check' : 'Take the mind check'}</a></div></section>
    <div class="stats-grid">
      <a class="stat-card" href="#/results"><strong>${latest ? latest.wellbeingIndex : '—'}</strong><span>${latest ? `Wellbeing index · ${esc(latest.overallBand)}` : 'No mind check yet'}</span></a>
      <a class="stat-card" href="#/mood"><strong>${lastMood ? lastMood.emoji : '—'}</strong><span>Latest mood · ${checkins.length} check-ins</span></a>
      <a class="stat-card" href="#/bookings"><strong>${upcoming.length}</strong><span>Upcoming sessions</span></a>
    </div>
    ${!latest ? `<section class="panel cta-panel"><div><h3 style="margin:0 0 6px">Start with a 5-minute mind check</h3><p class="muted" style="margin:0">Understand what's weighing on you and get matched with the right therapist.</p></div><a class="btn btn-primary" href="#/assessment">Begin</a></section>` : ''}
    <div class="two-col" style="margin-top:20px">
      <section class="panel"><div class="summary-heading"><h3 style="margin:0">Upcoming sessions</h3><a class="text-link" href="#/bookings">All →</a></div>
        ${upcoming.length ? upcoming.slice(0, 3).map(bookingRow).join('') : '<div class="empty-state">No sessions booked.<br><br><a class="btn btn-secondary" href="#/therapists">Find a therapist</a></div>'}</section>
      <section class="panel"><h3 style="margin-top:0">${latest?.recommendedLabels.length ? 'Areas to focus on' : 'Quick tools'}</h3>
        ${latest?.recommendedLabels.length ? `<div class="tag-row">${latest.recommendedLabels.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</div><a class="btn btn-primary" href="#/therapists">See matched therapists</a>` : ''}
        <div class="quick-links"><a href="#/calm">✦ Breathing & grounding</a><a href="#/mood">◷ Mood tracker</a><a href="#/results">◔ Mind-check history</a></div></section>
    </div></div>`;
}

async function therapistDashboard() {
  const [{ bookings }, { therapist }] = await Promise.all([api('/bookings'), api('/therapists/me/profile')]);
  const requests = bookings.filter((b) => b.status === 'requested');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const completed = bookings.filter((b) => b.status === 'completed');
  const statusNote = {
    pending: '<div class="notice">Your profile is <strong>awaiting admin approval</strong>. Complete it so our team can review you — you\'ll appear in the directory once approved.</div>',
    rejected: '<div class="notice">Your application was not approved. Please contact support.</div>',
    approved: '',
  }[therapist.status];
  return `<div class="container">
    <section class="dashboard-welcome"><div><div class="eyebrow">Therapist portal</div><h1>Hello, ${esc(session.user.name)}</h1><p class="muted" style="margin:0">${esc(therapist.title)} · ${esc(fmt.inr(therapist.feeInr))} / ${therapist.sessionMinutes} min</p></div>
      <div class="actions"><a class="btn btn-secondary" href="#/therapist/profile">Edit profile & hours</a></div></section>
    ${statusNote}
    <div class="stats-grid"><div class="stat-card"><strong>${requests.length}</strong><span>New requests</span></div><div class="stat-card"><strong>${upcoming.length}</strong><span>Confirmed sessions</span></div><div class="stat-card"><strong>${completed.length}</strong><span>Completed</span></div></div>
    <div class="two-col">
      <section class="panel"><h3 style="margin-top:0">New requests</h3>${requests.length ? requests.map(bookingRow).join('') : '<div class="empty-state">No pending requests.</div>'}</section>
      <section class="panel"><h3 style="margin-top:0">Confirmed</h3>${upcoming.length ? upcoming.map(bookingRow).join('') : '<div class="empty-state">Nothing scheduled yet.</div>'}</section>
    </div></div>`;
}

// ---------------- Therapist profile editor ----------------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function therapistProfileView() {
  const [{ therapist: t }, { specialities }, { languages }] = await Promise.all([api('/therapists/me/profile'), api('/therapists/specialities'), api('/auth/options')]);
  return {
    html: `<div class="container narrow">
      <div class="page-heading"><div class="eyebrow">Therapist portal · ${esc(t.status)}</div><h1>Your profile</h1><p>This is what clients see in the directory. Times are in IST.</p></div>
      <form class="panel" id="tp-form">
        <div class="field-row"><div class="field"><label for="title">Professional title</label><input id="title" name="title" required maxlength="80" value="${esc(t.title)}"></div>
          <div class="field"><label for="experienceYears">Years of experience</label><input id="experienceYears" name="experienceYears" type="number" min="0" max="60" value="${t.experienceYears}"></div></div>
        <div class="field"><label for="qualifications">Qualifications / registration</label><input id="qualifications" name="qualifications" maxlength="300" value="${esc(t.qualifications || '')}" placeholder="e.g. M.Phil Clinical Psychology, RCI reg. no."></div>
        <div class="field"><label>Specialities</label><div class="check-grid">${specialities.map((s) => `<label class="answer-option"><input type="checkbox" name="specialities" value="${s.key}" ${t.specialities.includes(s.key) ? 'checked' : ''}><span>${esc(s.label)}</span></label>`).join('')}</div></div>
        <div class="field"><label>Languages</label><div class="check-grid">${languages.map((l) => `<label class="answer-option"><input type="checkbox" name="languages" value="${esc(l)}" ${t.languages.includes(l) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
        <div class="field"><label for="about">About you (min 20 characters)</label><textarea id="about" name="about" rows="3" maxlength="800">${esc(t.about || '')}</textarea></div>
        <div class="field"><label for="approach">Your approach</label><textarea id="approach" name="approach" rows="2" maxlength="400">${esc(t.approach || '')}</textarea></div>
        <div class="field-row"><div class="field"><label for="feeInr">Fee per session (₹)</label><input id="feeInr" name="feeInr" type="number" min="0" max="20000" value="${t.feeInr}"></div>
          <div class="field"><label for="sessionMinutes">Session length (min)</label><input id="sessionMinutes" name="sessionMinutes" type="number" min="20" max="120" value="${t.sessionMinutes}"></div></div>
        <div class="field"><label>Working days</label><div class="check-grid days">${DAYS.map((d, i) => `<label class="answer-option"><input type="checkbox" name="workingDays" value="${i}" ${t.workingDays.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>
        <div class="field"><label for="slotTimes">Session start times (comma separated, 24h)</label><input id="slotTimes" name="slotTimes" value="${esc(t.slotTimes.join(', '))}" placeholder="10:00, 11:30, 16:00"></div>
        <button class="btn btn-primary" type="submit">Save profile</button>
      </form></div>`,
    mount(root) {
      const form = $('#tp-form', root);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = {
          title: fd.get('title'),
          experienceYears: Number(fd.get('experienceYears')),
          qualifications: fd.get('qualifications') || undefined,
          specialities: fd.getAll('specialities'),
          languages: fd.getAll('languages'),
          about: fd.get('about'),
          approach: fd.get('approach') || undefined,
          feeInr: Number(fd.get('feeInr')),
          sessionMinutes: Number(fd.get('sessionMinutes')),
          workingDays: fd.getAll('workingDays').map(Number),
          slotTimes: String(fd.get('slotTimes')).split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.padStart(5, '0')),
        };
        const button = form.querySelector('[type=submit]');
        setBusy(button, true, 'Saving…');
        try {
          await api('/therapists/me/profile', { method: 'PUT', body });
          toast('Profile saved.');
          navigate('/dashboard');
        } catch (error) {
          toast(error.message);
        } finally {
          setBusy(button, false);
        }
      });
    },
  };
}

// ---------------- Admin ----------------
export async function adminView() {
  const [stats, { therapists }] = await Promise.all([api('/admin/stats'), api('/admin/therapists')]);
  const tiles = [
    ['Clients', stats.users], ['Approved therapists', stats.therapists], ['Pending review', stats.pendingTherapists],
    ['Mind checks', stats.assessments], ['Safety flags', stats.crisisFlags], ['Active bookings', stats.activeBookings],
    ['Completed sessions', stats.completedSessions], ['Mood check-ins', stats.checkins],
  ];
  const order = { pending: 0, approved: 1, rejected: 2 };
  return {
    html: `<div class="container">
      <div class="page-heading"><div class="eyebrow">Admin</div><h1>Platform overview</h1></div>
      <div class="stats-grid four">${tiles.map(([l, v]) => `<div class="stat-card"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>
      <section class="panel"><h3 style="margin-top:0">Therapist applications & directory</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Title</th><th>Specialities</th><th>Exp.</th><th>Status</th><th></th></tr></thead><tbody>
        ${[...therapists].sort((a, b) => order[a.status] - order[b.status]).map((t) => `<tr>
          <td><strong>${esc(t.name)}</strong><br><small class="muted">${esc(t.email)}</small></td><td>${esc(t.title)}</td>
          <td>${t.specialityLabels.map((l) => `<span class="tag">${esc(l)}</span>`).join(' ') || '<small class="muted">—</small>'}</td>
          <td>${t.experienceYears}y</td><td><span class="pill status-${t.status === 'approved' ? 'confirmed' : t.status === 'rejected' ? 'cancelled' : 'requested'}">${esc(t.status)}</span></td>
          <td class="row-actions">${t.status !== 'approved' ? `<button class="btn btn-primary" data-status="approved" data-id="${t.id}">Approve</button>` : ''}${t.status !== 'rejected' ? `<button class="btn btn-quiet" data-status="rejected" data-id="${t.id}">${t.status === 'approved' ? 'Suspend' : 'Reject'}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></section></div>`,
    mount(root) {
      $$('[data-status]', root).forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/admin/therapists/${b.dataset.id}/status`, { method: 'POST', body: { status: b.dataset.status } });
          toast(`Therapist ${b.dataset.status}.`);
          navigate('/admin');
        } catch (error) {
          toast(error.message);
        }
      }));
    },
  };
}

// ---------------- Account ----------------
export async function accountView() {
  const { languages, ageGroups } = await api('/auth/options');
  const u = session.user;
  return {
    html: `<div class="container narrow">
      <div class="page-heading"><div class="eyebrow">Account</div><h1>Your details</h1></div>
      <form class="panel" id="acc-form">
        <div class="field"><label for="name">Name</label><input id="name" name="name" value="${esc(u.name)}" maxlength="70" required></div>
        <div class="field"><label>Email</label><input value="${esc(u.email)}" disabled></div>
        <div class="field-row">
          ${u.role === 'user' ? `<div class="field"><label for="ageGroup">Age group</label><select id="ageGroup" name="ageGroup"><option value="">Prefer not to say</option>${ageGroups.map((a) => `<option ${u.ageGroup === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>` : ''}
          <div class="field"><label for="language">Preferred language</label><select id="language" name="language">${languages.map((l) => `<option ${u.language === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        </div>
        <button class="btn btn-primary" type="submit">Save changes</button>
      </form>
      ${u.role !== 'admin' ? `<section class="panel danger-zone"><h3 style="margin-top:0">Delete account</h3><p class="muted">Permanently deletes your account, mind checks, check-ins, bookings and messages.</p><button class="btn btn-quiet clear-moods" id="delete-acc">Delete my account and data</button></section>` : ''}
    </div>`,
    mount(root) {
      $('#acc-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.target));
        if (!fd.ageGroup) delete fd.ageGroup;
        try {
          const { user } = await api('/auth/me', { method: 'PATCH', body: fd });
          session.user = user;
          toast('Saved.');
          navigate('/account');
        } catch (error) {
          toast(error.message);
        }
      });
      $('#delete-acc', root)?.addEventListener('click', async () => {
        if (!window.confirm('Delete your account and all data permanently?')) return;
        try {
          await api('/auth/me', { method: 'DELETE' });
          logout();
        } catch (error) {
          toast(error.message);
        }
      });
    },
  };
}
