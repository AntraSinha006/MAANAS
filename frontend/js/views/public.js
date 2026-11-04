import { api, session } from '../api.js';
import { setSession } from '../app.js';
import { $, esc, formData, navigate, setBusy, toast } from '../ui.js';

export function homeView() {
  const cta = session.user ? ['#/dashboard', 'Open my dashboard'] : ['#/signup', 'Take the free mind check'];
  return `<div class="container">
    <section class="hero">
      <div>
        <div class="eyebrow">Check in · Understand · Talk to someone</div>
        <h1>When your mind won't slow down,<br><em>you don't have to sort it alone.</em></h1>
        <p class="lead">MAANAS helps you take a short, private mind check on mood, worry, overthinking, sleep and clear thinking — then connects you with a human therapist or counsellor for a video or chat session.</p>
        <div class="actions"><a class="btn btn-primary" href="${cta[0]}">${cta[1]}</a><a class="btn btn-secondary" href="#/therapists">Browse therapists</a></div>
        <p class="muted" style="font-size:12px;margin-top:18px">Takes about 5 minutes. Not a diagnosis — a starting point for a conversation.</p>
      </div>
      <div class="hero-art"><div class="sun"></div><div class="hill"></div><div class="hill two"></div>
        <div class="art-note">A reminder<strong>You can take it one step at a time.</strong></div></div>
    </section>

    <section>
      <div class="eyebrow">How it works</div>
      <h2 class="section-title">Three gentle steps</h2>
      <div class="steps-grid">
        <article class="feature-card"><div class="step-num">1</div><h3>Take the mind check</h3><p>20 short questions plus a 30-second focus task. You see your own summary straight away.</p></article>
        <article class="feature-card"><div class="step-num">2</div><h3>Get matched</h3><p>We suggest therapists who work with what you're feeling — overthinking, stress, low mood, sleep and more — in your language.</p></article>
        <article class="feature-card"><div class="step-num">3</div><h3>Talk it through</h3><p>Book a slot, chat securely before the session, and join a video call from your browser.</p></article>
      </div>
    </section>

    <section style="margin-top:42px">
      <div class="eyebrow">Between sessions</div>
      <h2 class="section-title">Small tools that help</h2>
      <div class="feature-grid">
        <article class="feature-card"><div class="feature-icon">☁</div><h3>Daily check-in</h3><p>Notice how you're arriving today.</p><a class="text-link" href="#/checkin">Check in →</a></article>
        <article class="feature-card"><div class="feature-icon">◷</div><h3>Mood tracker</h3><p>See patterns in your week.</p><a class="text-link" href="#/mood">View tracker →</a></article>
        <article class="feature-card"><div class="feature-icon">♡</div><h3>Find a therapist</h3><p>Verified profiles, clear fees.</p><a class="text-link" href="#/therapists">Meet them →</a></article>
        <article class="feature-card"><div class="feature-icon">✦</div><h3>Calm tools</h3><p>Breathing and 5–4–3–2–1 grounding.</p><a class="text-link" href="#/calm">Try now →</a></article>
      </div>
    </section>
    <div class="notice" style="margin-top:30px">MAANAS is a student prototype. Therapist profiles are fictional demo content. It is not an emergency service — in a crisis call Tele-MANAS <a href="tel:14416">14416</a> or 112.</div>
  </div>`;
}

function demoBox() {
  return `<details class="demo-box"><summary>Demo accounts</summary>
    <ul>
      <li><button type="button" class="text-link" data-demo="demo@maanas.app|demo1234">User — demo@maanas.app / demo1234</button></li>
      <li><button type="button" class="text-link" data-demo="aanya@maanas.app|therapist123">Therapist — aanya@maanas.app / therapist123</button></li>
      <li><button type="button" class="text-link" data-demo="admin@maanas.app|admin1234">Admin — admin@maanas.app / admin1234</button></li>
    </ul></details>`;
}

export function loginView({ query }) {
  const next = query.get('next') || '/dashboard';
  return {
    html: `<div class="auth-wrap"><form class="form-card" id="login-form" novalidate>
      <div class="eyebrow">Welcome back</div><h1>Log in</h1><p>Continue to your MAANAS space.</p>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>
      <button class="btn btn-primary full" type="submit">Log in</button>
      <p style="text-align:center;font-size:13px;margin-top:18px">New to MAANAS? <a class="text-link" href="#/signup">Create an account</a></p>
      ${demoBox()}
    </form></div>`,
    mount(root) {
      const form = $('#login-form', root);
      root.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
        const [email, password] = b.dataset.demo.split('|');
        form.email.value = email;
        form.password.value = password;
      }));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('[type=submit]');
        setBusy(button, true, 'Logging in…');
        try {
          await setSession(await api('/auth/login', { method: 'POST', body: formData(form) }));
          toast(`Welcome back, ${session.user.name}.`);
          navigate(next);
        } catch (error) {
          if (error.code === 'EMAIL_NOT_VERIFIED') {
            sessionStorage.setItem('maanas_dev_code', error.details?.devCode || '');
            navigate(`/verify?email=${encodeURIComponent(error.details.email)}`);
          }
          toast(error.message);
        } finally {
          setBusy(button, false);
        }
      });
    },
  };
}

export async function signupView({ query }) {
  const { languages, ageGroups } = await api('/auth/options');
  const asTherapist = query.get('role') === 'therapist';
  return {
    html: `<div class="auth-wrap"><form class="form-card" id="signup-form" novalidate>
      <div class="eyebrow">Your space starts here</div><h1>Create your account</h1>
      <div class="segmented" role="radiogroup" aria-label="Account type">
        <label><input type="radio" name="role" value="user" ${asTherapist ? '' : 'checked'}><span>I'm looking for support</span></label>
        <label><input type="radio" name="role" value="therapist" ${asTherapist ? 'checked' : ''}><span>I'm a therapist</span></label>
      </div>
      <p id="role-hint" class="muted" style="font-size:13px"></p>
      <div class="field"><label for="name">Name</label><input id="name" name="name" autocomplete="name" required maxlength="70" placeholder="Your name"></div>
      <div class="field-row">
        <div class="field" id="age-field"><label for="ageGroup">Age group</label><select id="ageGroup" name="ageGroup"><option value="">Prefer not to say</option>${ageGroups.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
        <div class="field"><label for="language">Preferred language</label><select id="language" name="language">${languages.map((l) => `<option>${esc(l)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters"></div>
      <label class="consent"><input type="checkbox" name="consent" required> I understand MAANAS is a prototype and not an emergency or diagnostic service.</label>
      <button class="btn btn-primary full" type="submit">Create account</button>
      <p style="text-align:center;font-size:13px;margin-top:18px">Already have an account? <a class="text-link" href="#/login">Log in</a></p>
    </form></div>`,
    mount(root) {
      const form = $('#signup-form', root);
      const syncRole = () => {
        const therapist = form.role.value === 'therapist';
        $('#role-hint', root).textContent = therapist
          ? 'Therapist accounts are reviewed by our team before appearing in the directory. You can complete your profile after verifying your email.'
          : 'Take the mind check, track your mood and book sessions with therapists.';
        $('#age-field', root).classList.toggle('hidden', therapist);
      };
      form.querySelectorAll('[name=role]').forEach((r) => r.addEventListener('change', syncRole));
      syncRole();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = formData(form);
        if (!data.consent) return toast('Please tick the acknowledgement to continue.');
        if ((data.password || '').length < 8) return toast('Password must be at least 8 characters.');
        delete data.consent;
        if (!data.ageGroup || data.role === 'therapist') delete data.ageGroup;
        const button = form.querySelector('[type=submit]');
        setBusy(button, true, 'Creating…');
        try {
          const res = await api('/auth/signup', { method: 'POST', body: data });
          sessionStorage.setItem('maanas_dev_code', res.devCode || '');
          navigate(`/verify?email=${encodeURIComponent(res.email)}`);
        } catch (error) {
          toast(error.message);
        } finally {
          setBusy(button, false);
        }
      });
    },
  };
}

export function verifyView({ query }) {
  const email = query.get('email') || '';
  const devCode = sessionStorage.getItem('maanas_dev_code');
  return {
    html: `<div class="auth-wrap"><form class="form-card" id="otp-form" novalidate>
      <div class="eyebrow">One last step</div><h1>Verify your email</h1>
      <p>Enter the 6-digit code sent to <strong>${esc(email)}</strong>.</p>
      <div class="field"><label for="otp-code">Verification code</label><input id="otp-code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••" autocomplete="one-time-code" class="otp-input"></div>
      ${devCode ? `<div class="notice">Development mode: no email is sent. Your code is <strong id="dev-code">${esc(devCode)}</strong> (also printed in the server console).</div>` : ''}
      <button class="btn btn-primary full" type="submit">Verify and continue</button>
      <button class="btn btn-quiet full" type="button" id="resend">Send a new code</button>
    </form></div>`,
    mount(root) {
      const form = $('#otp-form', root);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('[type=submit]');
        setBusy(button, true, 'Verifying…');
        try {
          await setSession(await api('/auth/verify-otp', { method: 'POST', body: { email, code: form.code.value.trim() } }));
          sessionStorage.removeItem('maanas_dev_code');
          toast('Email verified. Welcome to MAANAS!');
          navigate(session.user.role === 'therapist' ? '/therapist/profile' : '/dashboard');
        } catch (error) {
          toast(error.message);
        } finally {
          setBusy(button, false);
        }
      });
      $('#resend', root).addEventListener('click', async () => {
        try {
          const res = await api('/auth/resend-otp', { method: 'POST', body: { email } });
          if (res.devCode) {
            sessionStorage.setItem('maanas_dev_code', res.devCode);
            const el = $('#dev-code', root);
            if (el) el.textContent = res.devCode;
          }
          toast('A new code has been sent.');
        } catch (error) {
          toast(error.message);
        }
      });
    },
  };
}
