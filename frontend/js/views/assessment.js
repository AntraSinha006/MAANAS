import { api } from '../api.js';
import { $, $$, crisisBox, esc, fmt, navigate, strainBar, toast } from '../ui.js';

const BAND_COPY = {
  Thriving: 'Things look fairly steady right now. Keep doing what helps you.',
  Managing: "You're coping, with a few areas that feel heavier. Small supports can make a real difference.",
  Struggling: 'Several areas feel hard at the moment. Talking with a therapist could really help.',
  'Needs support': "A lot is weighing on you right now. You deserve support — we'd encourage you to speak with a therapist soon.",
};

// ---------------- Focus task (Stroop-style) ----------------
const COLORS = [
  { name: 'RED', css: '#d64545' },
  { name: 'GREEN', css: '#2e8a57' },
  { name: 'BLUE', css: '#3f6fd8' },
  { name: 'ORANGE', css: '#e08a1e' },
];
const TRIALS = 10;

function focusTask(container, onDone) {
  let trial = 0;
  let correct = 0;
  const times = [];
  let shownAt = 0;
  let current = null;

  container.innerHTML = `<div class="focus-task">
    <p class="muted">Tap the <strong>colour of the ink</strong>, not the word. Go at a comfortable pace — ${TRIALS} rounds.</p>
    <div class="focus-progress"><span id="ft-progress">Round 1 of ${TRIALS}</span></div>
    <div class="focus-word" id="ft-word" aria-live="polite"></div>
    <div class="focus-buttons">${COLORS.map((c) => `<button type="button" class="btn btn-secondary" data-color="${c.name}"><span class="dot" style="background:${c.css}"></span>${c.name[0] + c.name.slice(1).toLowerCase()}</button>`).join('')}</div>
  </div>`;
  const word = $('#ft-word', container);

  function next() {
    if (trial >= TRIALS) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      onDone({ trials: TRIALS, correct, avgReactionMs: Math.min(Math.max(avg, 100), 20000) });
      return;
    }
    const text = COLORS[Math.floor(Math.random() * COLORS.length)];
    let ink = COLORS[Math.floor(Math.random() * COLORS.length)];
    if (Math.random() < 0.7) while (ink === text) ink = COLORS[Math.floor(Math.random() * COLORS.length)]; // mostly mismatched
    current = ink;
    word.textContent = text.name;
    word.style.color = ink.css;
    $('#ft-progress', container).textContent = `Round ${trial + 1} of ${TRIALS}`;
    shownAt = performance.now();
  }

  $$('[data-color]', container).forEach((b) => b.addEventListener('click', () => {
    if (!current) return;
    times.push(performance.now() - shownAt);
    if (b.dataset.color === current.name) correct++;
    trial++;
    current = null;
    word.textContent = '';
    setTimeout(next, 350);
  }));
  next();
}

// ---------------- Assessment flow ----------------
export async function assessmentView() {
  const bank = await api('/assessments/questions');
  const steps = [
    { kind: 'intro' },
    ...bank.sections.map((section) => ({ kind: 'section', section })),
    { kind: 'safety' },
    { kind: 'focus' },
  ];
  const state = { step: 0, answers: {}, focusTask: null };

  const html = `<div class="container narrow">
    <div class="page-heading"><div class="eyebrow">MAANAS mind check</div><h1>How has your mind been?</h1></div>
    <div class="assess-progress"><span id="assess-bar"></span></div>
    <div id="assess-body" class="panel"></div>
  </div>`;

  function mount(root) {
    const body = $('#assess-body', root);
    const bar = $('#assess-bar', root);

    const questionHtml = (item) => `<fieldset class="wellbeing-question"><legend>${esc(item.text)}</legend>
      <div class="answer-options four">${(item.options || bank.scale).map((opt) => `<label class="answer-option"><input type="radio" name="${item.id}" value="${opt.value}" ${state.answers[item.id] === opt.value ? 'checked' : ''}><span>${esc(opt.label)}</span></label>`).join('')}</div></fieldset>`;

    const nav = (nextLabel = 'Next') => `<div class="assess-nav">
      ${state.step > 0 ? '<button type="button" class="btn btn-quiet" data-back>← Back</button>' : '<span></span>'}
      <button type="button" class="btn btn-primary" data-next>${nextLabel}</button></div>`;

    function render() {
      const step = steps[state.step];
      bar.style.width = `${(state.step / (steps.length - 1)) * 100}%`;
      if (step.kind === 'intro') {
        body.innerHTML = `<h2 class="section-title">Before you start</h2>
          <ul class="calm-list">
            <li>20 questions about how you see the world, yourself, others, the future, your thoughts and inner experience — then a short focus task.</li>
            <li>${esc(bank.timeframe)}</li>
            <li>You can skip any question. Answer at least ${bank.minAnswers} for a useful summary.</li>
            <li>Your results are private to you. You choose whether to share them with a therapist when you book.</li>
          </ul>
          <div class="notice">This is a self-reflection tool, not a medical diagnosis.</div>${nav('Start')}`;
      } else if (step.kind === 'section') {
        const s = step.section;
        body.innerHTML = `<div class="eyebrow">${state.step} of ${steps.length - 1} · ${esc(s.title)}</div>
          <h2 class="section-title" style="margin-top:6px">${esc(s.intro)}</h2>
          <p class="muted" style="font-size:13px">${esc(bank.timeframe)}</p>
          ${s.items.map(questionHtml).join('')}${nav()}`;
      } else if (step.kind === 'safety') {
        body.innerHTML = `<div class="eyebrow">${state.step} of ${steps.length - 1} · Your safety</div>
          <h2 class="section-title" style="margin-top:6px">One important question</h2>
          <p class="muted" style="font-size:13px">We ask everyone this so we can make sure you have the right support. Your answer is not added to your score.</p>
          ${questionHtml(bank.safetyItem)}${nav()}`;
      } else if (step.kind === 'focus') {
        body.innerHTML = `<div class="eyebrow">${state.step} of ${steps.length - 1} · Clear thinking</div>
          <h2 class="section-title" style="margin-top:6px">A quick focus task</h2>
          <div id="focus-area"><p class="muted">This short colour–word task gives a small signal about focus right now. It's optional.</p>
          <div class="actions"><button type="button" class="btn btn-primary" id="focus-start">Start focus task</button><button type="button" class="btn btn-secondary" id="focus-skip">Skip and see results</button></div></div>
          <div class="assess-nav"><button type="button" class="btn btn-quiet" data-back>← Back</button><span></span></div>`;
        $('#focus-start', body).addEventListener('click', () => focusTask($('#focus-area', body), (result) => {
          state.focusTask = result;
          $('#focus-area', body).innerHTML = `<p><strong>Done!</strong> ${result.correct} of ${result.trials} correct · average ${(result.avgReactionMs / 1000).toFixed(2)}s per answer.</p>
            <button type="button" class="btn btn-primary" id="focus-submit">See my results</button>`;
          $('#focus-submit', body).addEventListener('click', submit);
        }));
        $('#focus-skip', body).addEventListener('click', submit);
      }

      $$('input[type=radio]', body).forEach((input) => input.addEventListener('change', () => {
        state.answers[input.name] = Number(input.value);
      }));
      $('[data-back]', body)?.addEventListener('click', () => { state.step--; render(); window.scrollTo({ top: 0 }); });
      $('[data-next]', body)?.addEventListener('click', () => { state.step++; render(); window.scrollTo({ top: 0 }); });
    }

    async function submit() {
      const answered = Object.keys(state.answers).filter((k) => k !== bank.safetyItem.id).length;
      if (answered < bank.minAnswers) {
        toast(`Please answer at least ${bank.minAnswers} questions (you've answered ${answered}).`);
        return;
      }
      body.innerHTML = '<div class="loading"><span class="spinner"></span>Preparing your summary…</div>';
      try {
        const res = await api('/assessments', { method: 'POST', body: { answers: state.answers, ...(state.focusTask ? { focusTask: state.focusTask } : {}) } });
        sessionStorage.setItem(`maanas_result_${res.assessment.id}`, JSON.stringify(res));
        navigate(`/results/${res.assessment.id}`);
      } catch (error) {
        toast(error.message);
        render();
      }
    }

    render();
  }

  return { html, mount };
}

export function resultCard(a) {
  return `<div class="result-hero">
      <div class="index-ring" style="--pct:${a.wellbeingIndex}"><div><strong>${a.wellbeingIndex}</strong><small>of 100</small></div></div>
      <div><div class="eyebrow">Wellbeing index · ${esc(fmt.date(a.createdAt))}</div>
        <h2 class="section-title" style="margin-top:6px">${esc(a.overallBand)}</h2>
        <p class="muted" style="margin:0">${esc(BAND_COPY[a.overallBand] || '')}</p></div>
    </div>
    <div class="score-list">${a.sections.map((s) => `<div class="score-row">
      <div class="score-label"><strong>${esc(s.title)}</strong><small>${s.answered}/${s.total} answered${s.taskStrain !== undefined ? ' + focus task' : ''}</small></div>
      ${strainBar(s.strain)}<span class="band band-${s.band}">${s.band}</span></div>`).join('')}</div>`;
}

export async function resultView({ params }) {
  const id = Number(params[0]);
  const cached = sessionStorage.getItem(`maanas_result_${id}`);
  const res = cached ? JSON.parse(cached) : await api(`/assessments/${id}`);
  const a = res.assessment;
  const recs = await api('/therapists/recommended');
  const top = recs.therapists.slice(0, 3);
  const suggest = res.suggestTherapist ?? (a.wellbeingIndex < 55 || a.crisisFlag);

  return `<div class="container">
    <a class="text-link" href="#/results">← All my results</a>
    ${crisisBox(res.crisisResources)}
    <section class="panel" style="margin-top:16px">${resultCard(a)}
      <p class="muted" style="font-size:12px;margin:18px 0 0">Higher bars mean that area has felt heavier lately. Scored by ${esc(a.modelVersion)} — a rules-based prototype, not a diagnosis.</p>
    </section>

    <section style="margin-top:28px">
      <div class="eyebrow">${suggest ? 'Recommended next step' : 'If you would like to talk'}</div>
      <h2 class="section-title">${suggest ? 'Talking to someone could help' : 'Therapists who fit your answers'}</h2>
      ${a.recommendedLabels.length ? `<p class="muted">Matched for: ${a.recommendedLabels.map((l) => `<span class="tag">${esc(l)}</span>`).join(' ')}</p>` : ''}
      <div class="consultant-grid">${top.map((t) => `<article class="consultant-card">
        <div class="consultant-top"><div class="consultant-avatar">${esc(t.initials)}</div><div><h3>${esc(t.name)}</h3><div class="consultant-speciality">${esc(t.title)}</div></div></div>
        <div class="tag-row">${t.matchReasons.map((r) => `<span class="tag tag-match">✓ ${esc(r)}</span>`).join('')}</div>
        <p class="consultant-meta">${esc(fmt.inr(t.feeInr))} · ${t.sessionMinutes} min</p>
        <a class="btn btn-primary" href="#/therapists/${t.id}">View & book</a></article>`).join('')}</div>
    </section>

    <section class="two-col" style="margin-top:28px">
      <div class="panel"><h3 style="margin-top:0">Meanwhile, try this</h3><p class="muted">A one-minute breathing pause or the 5–4–3–2–1 grounding exercise can help when thoughts are racing.</p><a class="btn btn-secondary" href="#/calm">Open calm tools</a></div>
      <div class="panel"><h3 style="margin-top:0">Track how it changes</h3><p class="muted">Retake the mind check every couple of weeks, and log a quick daily mood check-in.</p><a class="btn btn-secondary" href="#/checkin">Daily check-in</a></div>
    </section>
  </div>`;
}

export async function historyView() {
  const { assessments } = await api('/assessments');
  return `<div class="container">
    <div class="page-heading"><div class="eyebrow">Your mind checks</div><h1>Results over time</h1><p>Only you can see these unless you choose to share one when booking.</p></div>
    ${assessments.length ? `<div class="panel trend">${[...assessments].reverse().map((a) => `<a class="trend-bar" href="#/results/${a.id}" title="${esc(fmt.date(a.createdAt))}: ${a.wellbeingIndex}"><span style="height:${Math.max(a.wellbeingIndex, 4)}%"></span><small>${esc(fmt.date(a.createdAt).replace(/ \d{4}$/, ''))}</small></a>`).join('')}</div>
    <section class="panel" style="margin-top:18px">${assessments.map((a) => `<a class="history-item link-row" href="#/results/${a.id}"><span><strong>${esc(a.overallBand)}</strong> · index ${a.wellbeingIndex}<br><small class="muted">${esc(fmt.dateTime(a.createdAt))}${a.recommendedLabels.length ? ' · ' + esc(a.recommendedLabels.join(', ')) : ''}</small></span><span class="text-link">View →</span></a>`).join('')}</section>`
      : '<div class="panel empty-state">No results yet.<br><br><a class="btn btn-primary" href="#/assessment">Take the mind check</a></div>'}
    <div class="actions"><a class="btn btn-primary" href="#/assessment">Take a new mind check</a></div>
  </div>`;
}
