require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
let actor = { id: 'officer', role: 'officer' };
let demoMode = true;
function mockModule(id, exports) {
  const filename = require.resolve(id);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
mockModule('@/lib/auth', { getAuthenticatedStudent: async () => actor });
mockModule('@/lib/supabase', { getSupabaseAdmin: () => null, isDemoMode: () => demoMode });
mockModule('@/lib/analytics-cache', { invalidateAnalyticsCache: () => {} });
const { POST } = require('../app/api/tournaments/import/route.ts');
function request(body) {
  return new Request('https://www.sciolytracker.com/api/tournaments/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}
const valid = { rawInput: 'Event,Rank,School,Team,Students\nAstronomy,1,Obra D Tompkins High School,A,Amy', date: '2026-11-07' };

test('tournament API rejects invalid JSON and field types with 400 instead of crashing', async () => {
  const malformed = new Request('https://www.sciolytracker.com/api/tournaments/import', { method: 'POST', body: '{' });
  assert.equal((await POST(malformed)).status, 400);
  for (const body of [null, [], { rawInput: 123 }, { ...valid, tournamentName: 123 },
    { ...valid, medalCutoff: -1 }, { ...valid, participationPoints: 1.5 },
    { ...valid, participantSelections: { 'csv-2': null } },
    { ...valid, participantSelections: { 'csv-2': { confirmed: true, studentIds: 'amy' } } }]) {
    assert.equal((await POST(request(body))).status, 400, JSON.stringify(body));
  }
});

test('ordinary members cannot use administrative import previews', async () => {
  actor = { id: 'viewer', role: 'viewer' };
  try { assert.equal((await POST(request(valid))).status, 403); }
  finally { actor = { id: 'officer', role: 'officer' }; }
});

test('missing production storage cannot report a successful demo commit', async () => {
  demoMode = false;
  try { assert.equal((await POST(request({ ...valid, commit: true }))).status, 503); }
  finally { demoMode = true; }
});
