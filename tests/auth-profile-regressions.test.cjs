require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
let responses = [];
let operations = [];
const client = {
  from(table) {
    const operation = { table, filters: [], action: 'read' };
    const builder = {
      select() { return this; },
      eq(field, value) { operation.filters.push([field, value]); return this; },
      upsert(values, options) { operation.action = 'upsert'; operation.values = values; operation.options = options; return this; },
      update(values) { operation.action = 'update'; operation.values = values; return this; },
      async maybeSingle() {
        operations.push(operation);
        assert.ok(responses.length, 'unexpected database operation');
        return responses.shift();
      },
      async single() { return this.maybeSingle(); }
    };
    return builder;
  }
};
const supabaseModule = require.resolve('@/lib/supabase');
require.cache[supabaseModule] = { id: supabaseModule, filename: supabaseModule, loaded: true, exports: {
  getSupabaseAdmin: () => client,
  getSupabaseServerClient: async () => client,
  hasSupabaseConfig: () => true
} };
const { ensureStudentProfile } = require('../lib/auth.ts');
const input = { authUserId: 'auth-1', email: 'member@example.com', name: 'New default name', grade: 9 };
const existing = {
  id: 'student-1', auth_user_id: 'auth-1', email: input.email, name: 'Existing member', role: 'officer', grade: 12,
  ovr_rating: 92, total_points: 1250, prev_ovr: 88, profile_events: ['Astronomy'], is_active: true, created_at: '2026-01-01'
};
const missing = { data: null, error: null };
function reset(...results) { responses = [...results]; operations = []; }
function writes() { return operations.filter((operation) => operation.action !== 'read'); }

test('auth-ID lookup failures cannot create or reset a student profile', async () => {
  reset({ data: null, error: { code: '57014', message: 'Statement timeout' } });
  assert.equal(await ensureStudentProfile(input), null);
  assert.equal(operations.length, 1);
  assert.deepEqual(writes(), []);
});

test('email lookup failures cannot create or reset a student profile', async () => {
  reset(missing, { data: null, error: { message: 'Database unavailable' } });
  assert.equal(await ensureStudentProfile(input), null);
  assert.equal(operations.length, 2);
  assert.deepEqual(writes(), []);
});

test('concurrent profile creation preserves existing role, name, grade, ratings, and points', async () => {
  reset(missing, missing, missing, { data: existing, error: null });
  const profile = await ensureStudentProfile(input);
  assert.equal(profile.id, existing.id);
  assert.equal(profile.role, 'officer');
  assert.equal(profile.name, 'Existing member');
  assert.equal(profile.grade, 12);
  assert.equal(profile.ovrRating, 92);
  assert.equal(profile.totalPoints, 1250);
  assert.deepEqual(profile.profileEvents, ['Astronomy']);
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].action, 'upsert');
  assert.deepEqual(writes()[0].options, { onConflict: 'email', ignoreDuplicates: true });
});

test('an auth-ID unique conflict reuses the concurrent profile without overwriting it', async () => {
  reset(missing, missing, { data: null, error: { code: '23505' } }, { data: existing, error: null });
  assert.equal((await ensureStudentProfile(input)).totalPoints, 1250);
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].options.ignoreDuplicates, true);
});

test('concurrent archived profiles remain inaccessible', async () => {
  reset(missing, missing, missing, { data: { ...existing, is_active: false }, error: null });
  assert.equal(await ensureStudentProfile(input), null);
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].options.ignoreDuplicates, true);
});

test('a failed or empty conflict reread never loops into another creation', async () => {
  reset(missing, missing, missing, { data: null, error: { message: 'Temporary failure' } });
  assert.equal(await ensureStudentProfile(input), null);
  assert.equal(writes().length, 1);
  reset(missing, missing, missing, missing, missing);
  assert.equal(await ensureStudentProfile(input), null);
  assert.equal(writes().length, 1);
});

test('new profiles still initialize when both lookups confirm absence', async () => {
  const created = { ...existing, name: input.name, grade: input.grade, role: 'viewer', total_points: 0, ovr_rating: 60 };
  reset(missing, missing, { data: created, error: null });
  assert.equal((await ensureStudentProfile(input)).name, input.name);
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].values.auth_user_id, input.authUserId);
});
