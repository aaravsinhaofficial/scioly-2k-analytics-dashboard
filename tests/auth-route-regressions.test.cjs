require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEGAL_VERSION } = require('../lib/legal.ts');
const calls = [];
let signOutError = null;
let clientAvailable = true;
const authClient = { auth: {
  signInWithPassword: async (input) => { calls.push(['login', input]); return { error: null }; },
  signUp: async (input) => { calls.push(['signup', input]); return { data: { user: { id: 'student' }, session: null }, error: null }; },
  signOut: async () => { calls.push(['logout']); return { error: signOutError }; },
  resetPasswordForEmail: async (...input) => { calls.push(['reset', ...input]); return { error: null }; },
  updateUser: async (input) => { calls.push(['update', input]); return { error: null }; },
  signInWithOAuth: async (input) => { calls.push(['google', input]); return { data: { url: 'https://accounts.google.com/example' }, error: null }; }
} };
function mockModule(id, exports) {
  const filename = require.resolve(id);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
mockModule('@/lib/auth', {
  getAuthenticatedStudent: async () => ({ id: 'student', role: 'viewer' }),
  recordLegalAcceptance: async () => true,
  publicSignupEnabled: () => true,
  ensureStudentProfile: async () => ({ id: 'student' })
});
mockModule('@/lib/supabase', { hasSupabaseConfig: () => true, getSupabaseServerClient: async () => clientAvailable ? authClient : null });
const routes = Object.fromEntries(['login', 'signup', 'google', 'password-reset', 'update-password', 'logout'].map((name) => [name, require(`../app/api/auth/${name}/route.ts`).POST]));
const policies = { acceptedPolicies: true, legalVersion: LEGAL_VERSION };
const validSignup = { ...policies, name: 'Student', grade: 11, email: 'student@example.com', password: 'NewPassword1!' };
function request(body, host = 'https://www.sciolytracker.com', raw = false) {
  return new Request(`${host}/api/auth/example`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
}

test('all auth endpoints reject malformed JSON and non-object bodies without calling the provider', async () => {
  calls.length = 0;
  for (const name of ['login', 'signup', 'google', 'password-reset', 'update-password']) {
    for (const value of ['{', 'null', '[]', '123', '"text"']) {
      assert.equal((await routes[name](request(value, undefined, true))).status, 400, `${name}: ${value}`);
    }
  }
  assert.deepEqual(calls, []);
});

test('auth routes reject wrong text field types before provider requests', async () => {
  calls.length = 0;
  const invalid = {
    login: [{ ...policies, email: 123, password: 'oldpw' }, { ...policies, email: 'a@b.com', password: 123 }, { ...policies, email: 'a@b.com', password: 'oldpw', next: [] }],
    signup: [{ ...validSignup, name: {} }, { ...validSignup, email: 123 }, { ...validSignup, password: { length: 20 } }, { ...validSignup, grade: [11] }],
    google: [{ ...policies, next: {} }, { ...policies, signup: 'yes' }],
    'password-reset': [{ email: 123 }],
    'update-password': [{ password: 123 }, { password: { length: 20 } }]
  };
  for (const [name, bodies] of Object.entries(invalid)) {
    for (const body of bodies) assert.equal((await routes[name](request(body))).status, 400, name);
  }
  assert.deepEqual(calls, []);
});

test('existing passwords can sign in without applying new-password rules', async () => {
  calls.length = 0;
  const response = await routes.login(request({ ...policies, email: ' STUDENT@EXAMPLE.COM ', password: 'oldpw', next: '//evil.example' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], ['login', { email: 'student@example.com', password: 'oldpw' }]);
  assert.equal((await response.json()).redirectTo, '/dashboard');
});

test('signup and password updates still enforce new-password rules', async () => {
  calls.length = 0;
  assert.equal((await routes.signup(request({ ...validSignup, password: 'oldpw' }))).status, 400);
  assert.equal((await routes['update-password'](request({ password: 'oldpw' }))).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await routes.signup(request(validSignup))).status, 200);
  assert.equal((await routes['update-password'](request({ password: validSignup.password }))).status, 200);
});

test('OAuth and password recovery callbacks stay on the initiating host', async () => {
  calls.length = 0;
  const host = 'https://preview.example.vercel.app';
  assert.equal((await routes.google(request({ ...policies, next: '/points' }, host))).status, 200);
  assert.equal((await routes['password-reset'](request({ email: ' student@example.com ' }, host))).status, 200);
  assert.equal(calls[0][1].options.redirectTo, `${host}/auth/callback?next=%2Fpoints`);
  assert.equal(calls[1][2].redirectTo, `${host}/auth/callback?next=%2Freset-password%3Fmode%3Dupdate`);
});

test('signup confirmation stays on the initiating host despite a production APP_URL', async () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = 'https://www.sciolytracker.com';
  calls.length = 0;
  try {
    const host = 'https://preview.example.vercel.app';
    assert.equal((await routes.signup(request(validSignup, host))).status, 200);
    assert.equal(calls[0][1].options.emailRedirectTo, `${host}/auth/callback?next=/dashboard`);
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});

test('provider sign-out errors reach the client instead of reporting success', async () => {
  signOutError = { message: 'Provider unavailable' };
  try {
    const response = await routes.logout();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  } finally { signOutError = null; }
});

test('missing auth client cannot report a successful sign-out', async () => {
  clientAvailable = false;
  calls.length = 0;
  try {
    const response = await routes.logout();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
    assert.deepEqual(calls, []);
  } finally { clientAvailable = true; }
});
