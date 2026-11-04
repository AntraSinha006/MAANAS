import { api } from '../api.js';
import { $, $$, MOODS, esc, fmt, navigate, toast } from '../ui.js';

const CHECKIN_QUESTIONS = [
  { id: 'overall', title: 'How have you been feeling overall today?', options: ['Very good', 'Mostly okay', 'Up and down', 'Low'] },
  { id: 'stress', title: 'How much stress are you carrying?', options: ['Very little', 'A little', 'Some', 'A lot'] },
  { id: 'sleep', title: 'How did you sleep last night?', options: ['Restful', 'Mostly okay', 'A bit difficult', 'Very difficult'] },
  { id: 'energy', title: 'How is your energy?', options: ['Plenty', 'About usual', 'Lower than usual', 'Very low'] },
  { id: 'connection', title: 'Have you felt supported by people around you?', options: ['Yes, definitely', 'Mostly', 'A little', 'Not really'] },
];

export function checkinView() {
  let mood = null;
  return {
    html: `<div class="container narrow">
      <div class="page-heading"><div class="eyebrow">A moment for yourself</div><h1>Daily check-in</h1><p>Thirty seconds to notice how you're arriving today. Skip anything you like.</p></div>
      <form id="checkin-form" class="panel wellbeing-form">
        <h3 style="margin-top:0">How are you feeling right now?</h3>
        <div class="mood-options">${MOODS.map((m) => `<button type="button" class="mood-option" data-mood="${m.id}"><span>${m.emoji}</span><small>${m.label}</small></button>`).join('')}</div>
        ${CHECKIN_QUESTIONS.map((q, i) => `<fieldset class="wellbeing-question"><legend><span class="question-number">${i + 1}</span>${q.title}</legend>
          <div class="answer-options">${q.options.map((o) => `<label class="answer-option"><input type="radio" name="${q.id}" value="${o}"><span>${o}</span></label>`).join('')}</div></fieldset>`).join('')}
        <div class="field"><label for="note">Anything you'd like to note? (optional)</label><textarea id="note" name="note" rows="3" maxlength="500" placeholder="A thought, a moment, or a few words…"></textarea></div>
        <button class="btn btn-primary" type="submit">Save check-in</button>
      </form></div>`,
    mount(root) {
      $$('[data-mood]', root).forEach((b) => b.addEventListener('click', () => {
        mood = b.dataset.mood;
        $$('[data-mood]', root).forEach((x) => x.classList.toggle('selected', x === b));
      }));
      $('#checkin-form', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!mood) return toast('Pick the mood that fits best to save your check-in.');
        const fd = new FormData(e.target);
        const answers = {};
        CHECKIN_QUESTIONS.forEach((q) => { if (fd.get(q.id)) answers[q.id] = fd.get(q.id); });
        try {
          await api('/checkins', { method: 'POST', body: { mood, answers, note: String(fd.get('note') || '').trim() || undefined } });
          toast('Check-in saved. Thank you for taking a moment for yourself.');
          navigate('/mood');
        } catch (error) {
          toast(error.message);
        }
      });
    },
  };
}

export async function moodView() {
  const { checkins, summary } = await api('/checkins');
  const max = Math.max(1, ...Object.values(summary.counts));
  return {
    html: `<div class="container">
      <div class="page-heading"><div class="eyebrow">Notice, don't judge</div><h1>Your mood tracker</h1><p>Your check-ins are saved securely to your MAANAS account.</p></div>
      <section class="panel mood-summary-panel">
        <div class="summary-heading"><div><h3 style="margin:0 0 5px">Last 7 days</h3><p class="muted" style="margin:0;font-size:13px">How often each mood showed up.</p></div><span class="pill">${summary.lastSevenDays} ${summary.lastSevenDays === 1 ? 'entry' : 'entries'}</span></div>
        ${summary.lastSevenDays ? `<div class="mood-bars">${MOODS.map((m) => `<div class="mood-bar"><div class="mood-bar-track"><span style="height:${(summary.counts[m.id] / max) * 100}%"></span></div><strong>${summary.counts[m.id]}</strong><span class="summary-emoji">${m.emoji}</span><small>${m.label}</small></div>`).join('')}</div>`
          : '<div class="empty-state">No check-ins from the last 7 days yet.</div>'}
      </section>
      <div class="two-col mood-history-layout">
        <section class="panel"><div class="summary-heading"><h3 style="margin:0">History</h3><span class="muted" style="font-size:12px">${checkins.length} saved</span></div>
          ${checkins.length ? `<div class="mood-history-list">${checkins.map((c) => {
            const m = MOODS.find((x) => x.id === c.mood);
            return `<article class="mood-history-entry"><div class="history-mood-emoji">${m?.emoji || '🌿'}</div><div class="mood-history-copy"><strong>${esc(fmt.dateTime(c.createdAt))}</strong><span>${esc(m?.label || c.mood)}</span>${c.note ? `<p>${esc(c.note)}</p>` : ''}
              ${Object.keys(c.answers).length ? `<details><summary>Reflection answers</summary><ul>${Object.entries(c.answers).map(([k, v]) => `<li><strong>${esc(k[0].toUpperCase() + k.slice(1))}:</strong> ${esc(v)}</li>`).join('')}</ul></details>` : ''}</div></article>`;
          }).join('')}</div>
          <div class="data-actions"><button class="btn btn-secondary" id="export-csv" type="button">Export CSV</button><button class="btn btn-quiet clear-moods" id="clear-moods" type="button">Delete all check-ins</button></div>`
          : '<div class="empty-state">Your check-ins will appear here.<br><br><a class="btn btn-secondary" href="#/checkin">Add your first check-in</a></div>'}
        </section>
        <section class="panel"><h3 style="margin-top:0">A gentle reminder</h3><p class="muted">Moods change through the day. One difficult moment doesn't define your whole story.</p>
          <div class="notice">If low or anxious days keep showing up, a conversation with a therapist can help.</div>
          <div class="actions" style="margin-top:12px"><a class="btn btn-primary" href="#/checkin">Check in now</a><a class="btn btn-secondary" href="#/therapists">Find a therapist</a></div></section>
      </div></div>`,
    mount(root) {
      $('#export-csv', root)?.addEventListener('click', () => {
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [['Date', 'Mood', 'Note', 'Answers'], ...checkins.map((c) => [c.createdAt, c.mood, c.note || '', JSON.stringify(c.answers)])];
        const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'maanas-mood-history.csv' });
        document.body.appendChild(a); a.click(); a.remove();
        toast('Export ready. Keep the file somewhere private.');
      });
      $('#clear-moods', root)?.addEventListener('click', async () => {
        if (!window.confirm('Delete all your mood check-ins? This cannot be undone.')) return;
        await api('/checkins', { method: 'DELETE' });
        toast('All check-ins deleted.');
        navigate('/mood');
      });
    },
  };
}

const SENSES = [
  { n: 5, label: 'things you can see', hint: 'Look around and name five things you can see.' },
  { n: 4, label: 'things you can feel', hint: 'Notice four things you can physically feel, like your feet on the floor.' },
  { n: 3, label: 'things you can hear', hint: 'Listen for three sounds, near or far.' },
  { n: 2, label: 'things you can smell', hint: 'Notice two scents, or two smells you remember.' },
  { n: 1, label: 'thing you can taste', hint: 'Notice one taste, or take a sip of water.' },
];

export function calmView() {
  return {
    html: `<div class="container">
      <div class="page-heading"><div class="eyebrow">Gentle support tools</div><h1>Calm tools</h1><p>Try a short breathing pause or a grounding exercise. You can stop at any time.</p></div>
      <div class="calm-grid">
        <section class="panel calm-breath-panel"><div class="eyebrow">One-minute breathing pause</div><h2 class="section-title" style="margin-top:8px">Breathe at your own pace</h2>
          <p class="muted">Follow the cue — in for four, out for four. No breath-holding. If it feels uncomfortable, try grounding instead.</p>
          <div class="guided-breath"><div id="breath-circle" class="guided-breath-circle"><span id="breath-phase">Ready when you are</span></div></div>
          <p class="breath-timer" id="breath-timer" aria-live="polite">01:00 remaining</p>
          <div class="actions" style="justify-content:center;margin-top:12px"><button id="breath-start" class="btn btn-primary" type="button">Start breathing</button><button id="breath-reset" class="btn btn-secondary" type="button">Reset</button></div>
        </section>
        <section class="panel grounding-panel"><div class="eyebrow">5–4–3–2–1 grounding</div><h2 class="section-title" style="margin-top:8px">Notice the present moment</h2>
          <p class="muted">Move through the senses gently. Skip any prompt that doesn't feel right.</p>
          <div class="grounding-list">${SENSES.map((s, i) => `<label class="grounding-step"><input type="checkbox" data-step="${i}"><span class="grounding-count">${s.n}</span><span><strong>${s.label}</strong><small>${s.hint}</small></span></label>`).join('')}</div>
          <div class="grounding-progress"><div class="grounding-progress-track"><span id="g-fill" style="width:0%"></span></div><small id="g-label">0 of 5 steps explored</small></div>
          <div class="actions"><button id="g-reset" class="btn btn-secondary" type="button">Start again</button></div>
        </section>
      </div>
      <div class="notice" style="margin-top:22px">These are self-care tools, not treatment. If you are in immediate danger, call 112 or Tele-MANAS <a href="tel:14416">14416</a>.</div>
    </div>`,
    mount(root) {
      let interval = null;
      let remaining = 60;
      let elapsed = 0;
      const phase = $('#breath-phase', root);
      const timer = $('#breath-timer', root);
      const start = $('#breath-start', root);
      const circle = $('#breath-circle', root);
      const update = (label) => {
        timer.textContent = `00:${String(remaining).padStart(2, '0')} remaining`.replace('00:60', '01:00');
        phase.textContent = label;
        start.textContent = interval ? 'Pause' : remaining < 60 && remaining > 0 ? 'Resume' : 'Start breathing';
        circle.classList.toggle('is-inhale', label === 'Breathe in');
        circle.classList.toggle('is-exhale', label === 'Breathe out');
      };
      const stop = () => { clearInterval(interval); interval = null; };
      start.addEventListener('click', () => {
        if (interval) { stop(); update('Paused'); return; }
        if (remaining <= 0) { remaining = 60; elapsed = 0; }
        interval = setInterval(() => {
          elapsed++; remaining--;
          if (remaining <= 0) { stop(); update('Finished — notice how you feel'); toast('Breathing pause complete.'); return; }
          update(elapsed % 8 < 4 ? 'Breathe in' : 'Breathe out');
        }, 1000);
        update('Breathe in');
      });
      $('#breath-reset', root).addEventListener('click', () => { stop(); remaining = 60; elapsed = 0; update('Ready when you are'); });

      const steps = $$('[data-step]', root);
      const sync = () => {
        const done = steps.filter((s) => s.checked).length;
        $('#g-fill', root).style.width = `${(done / 5) * 100}%`;
        $('#g-label', root).textContent = `${done} of 5 steps explored`;
      };
      steps.forEach((s) => s.addEventListener('change', sync));
      $('#g-reset', root).addEventListener('click', () => { steps.forEach((s) => { s.checked = false; }); sync(); });
      return stop; // stop the timer when leaving the page
    },
  };
}
