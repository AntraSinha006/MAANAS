import { api, session } from './api.js';
import { $, esc, errorView, loading, toast, navigate } from './ui.js';
import * as pub from './views/public.js';
import * as assess from './views/assessment.js';
import * as well from './views/wellbeing.js';
import * as ther from './views/therapists.js';
import * as sess from './views/sessions.js';
import * as portal from './views/portal.js';

const content = $('#main-content');
let cleanup = null;

// [pattern, view, access] — access: undefined = public, 'auth' = any logged-in user, or a role name.
const ROUTES = [
  [/^\/$/, pub.homeView],
  [/^\/login$/, pub.loginView, 'guest'],
  [/^\/signup$/, pub.signupView, 'guest'],
  [/^\/verify$/, pub.verifyView, 'guest'],
  [/^\/dashboard$/, portal.dashboardView, 'auth'],
  [/^\/assessment$/, assess.assessmentView, 'user'],
  [/^\/results$/, assess.historyView, 'user'],
  [/^\/results\/(\d+)$/, assess.resultView, 'user'],
  [/^\/checkin$/, well.checkinView, 'user'],
  [/^\/mood$/, well.moodView, 'user'],
  [/^\/calm$/, well.calmView],
  [/^\/therapists$/, ther.directoryView],
  [/^\/therapists\/(\d+)$/, ther.profileView],
  [/^\/bookings$/, sess.bookingsView, 'auth'],
  [/^\/session\/(\d+)$/, sess.sessionView, 'auth'],
  [/^\/therapist\/profile$/, portal.therapistProfileView, 'therapist'],
  [/^\/admin$/, portal.adminView, 'admin'],
  [/^\/account$/, portal.accountView, 'auth'],
];

const NAV = {
  guest: [['/', 'Home'], ['/therapists', 'Therapists'], ['/calm', 'Calm tools']],
  user: [['/dashboard', 'Dashboard'], ['/assessment', 'Mind check'], ['/therapists', 'Therapists'], ['/bookings', 'My sessions'], ['/mood', 'Mood'], ['/calm', 'Calm tools']],
  therapist: [['/dashboard', 'Dashboard'], ['/bookings', 'Sessions'], ['/therapist/profile', 'My profile']],
  admin: [['/admin', 'Admin'], ['/therapists', 'Directory']],
};

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

function renderChrome(path) {
  const role = session.user?.role || 'guest';
  $('#main-nav').innerHTML = NAV[role]
    .map(([href, label]) => `<a href="#${href}" class="nav-link ${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}">${label}</a>`)
    .join('');
  $('#header-actions').innerHTML = session.user
    ? `<a class="user-chip" href="#/account" title="Account">${esc(session.user.name)}${role !== 'user' ? ` · ${role}` : ''}</a><button class="btn btn-quiet" id="logout-btn">Log out</button>`
    : `<a class="btn btn-quiet" href="#/login">Log in</a><a class="btn btn-primary" href="#/signup">Get started</a>`;
  $('#main-nav').classList.remove('open');
}

async function router() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  const { path, query } = currentPath();
  const match = ROUTES.map(([re, view, access]) => ({ m: path.match(re), view, access })).find((r) => r.m);
  renderChrome(path);

  if (!match) {
    content.innerHTML = `<div class="container"><div class="panel empty-state"><h2>Page not found</h2><a class="btn btn-primary" href="#/">Go home</a></div></div>`;
    return;
  }
  const role = session.user?.role;
  if (match.access === 'guest' && role) return navigate('/dashboard');
  if (match.access && match.access !== 'guest' && !role) {
    toast('Please log in to continue.');
    return navigate(`/login?next=${encodeURIComponent(path)}`);
  }
  if (match.access && !['guest', 'auth'].includes(match.access) && role !== match.access) {
    toast('That page is not available for your account.');
    return navigate('/dashboard');
  }

  content.innerHTML = loading();
  const token = Symbol('render');
  router.current = token;
  try {
    const result = await match.view({ params: match.m.slice(1), query, path });
    if (router.current !== token) return; // user navigated away meanwhile
    const { html, mount } = typeof result === 'string' ? { html: result } : result;
    content.innerHTML = html;
    window.scrollTo({ top: 0 });
    content.focus({ preventScroll: true });
    if (mount) cleanup = mount(content) || null;
  } catch (error) {
    if (router.current !== token) return;
    if (error.status === 401) {
      renderChrome(path);
      return navigate('/login');
    }
    content.innerHTML = errorView(error);
  }
}

export async function setSession({ token, user, therapist }) {
  if (token) session.token = token;
  session.user = user;
  session.therapist = therapist || null;
}

export function logout() {
  session.token = null;
  session.user = null;
  session.therapist = null;
  toast('You have logged out.');
  navigate('/');
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#logout-btn')) logout();
  if (e.target.closest('#menu-toggle')) $('#main-nav').classList.toggle('open');
});
window.addEventListener('hashchange', router);

(async function boot() {
  if (session.token) {
    try {
      await setSession(await api('/auth/me'));
    } catch {
      session.token = null;
    }
  }
  router();
})();
