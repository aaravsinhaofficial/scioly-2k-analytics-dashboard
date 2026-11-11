const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const pending = {
  id: 7, student_id: 'student', activity_type: 'solo_study', points: 45,
  minutes: 60, quantity: null, custom_label: null, custom_category_id: null,
  metadata: {}, is_approved: false, status: 'pending', submitted_at: '2026-11-01T12:00:00Z',
  approved_at: null, approved_by: null, notes: null
};
const approved = { ...pending, status: 'approved', is_approved: true,
  approved_at: '2026-11-02T12:00:00Z', approved_by: 'officer' };

function route(file, database, options = {}) {
  const calls = [];
  let reads = 0;
  const client = { from(table) {
    let action = 'read', values, single = false;
    const predicates = [];
    const query = {
      select() { return query; },
      update(value) { action = 'update'; values = value; return query; },
      insert(value) { action = 'insert'; values = value; return query; },
      eq(key, value) { predicates.push(row => row[key] === value); return query; },
      gt(key, value) { predicates.push(row => row[key] > value); return query; },
      is(key, value) { predicates.push(row => (row[key] ?? null) === value); return query; },
      limit() { return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) {
        calls.push({ table, action, values });
        if (action === 'insert') { database[table].push(values); return Promise.resolve({ data: values, error: null }).then(resolve, reject); }
        if (action === 'update' && table === 'grind_points') options.beforePointUpdate?.(database);
        let rows = database[table].filter(row => predicates.every(predicate => predicate(row)));
        if (action === 'read' && table === 'grind_points' && options.staleRead && reads++ === 0) rows = [{ ...pending }];
        if (action === 'update') rows.forEach(row => Object.assign(row, values));
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
      }
    };
    return query;
  }};
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/activity': { activityLabels: { solo_study: 'Solo Study' } },
    '@/lib/auth': { getAuthenticatedStudent: async () => ({ id: 'admin', role: 'admin' }) },
    '@/lib/analytics': { getCurrentDemoUser() {} },
    '@/lib/analytics-cache': { invalidateAnalyticsCache() {} },
    '@/lib/library-data': { invalidateLibraryCache() {} },
    '@/lib/seed': { mockPointLogs: [], mockStudents: [], mockTeams: [] },
    '@/lib/point-evidence': {},
    '@/lib/supabase': { getSupabaseAdmin: () => client, isDemoMode: () => false },
    '@/lib/utils': { roleMeets: () => true }
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports: module.exports, module, require(name) {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }, Date, Promise, Set, Map, Number, String, JSON });
  return { ...module.exports, calls };
}
function request(body) { return { json: async () => body, headers: { get: () => null } }; }

test('stale officer reviews cannot overwrite a completed review or create a duplicate audit', async () => {
  const db = { grind_points: [{ ...approved }], audit_logs: [] };
  const handler = route('app/api/admin/points/route.ts', db, { staleRead: true });
  const response = await handler.PATCH(request({ id: 7, decision: 'rejected', notes: 'Needs evidence' }));
  assert.equal(response.status, 409);
  assert.equal(db.grind_points[0].status, 'approved');
  assert.equal(db.audit_logs.length, 0);
});

test('successful review records the complete after snapshot for safe undo', async () => {
  const db = { grind_points: [{ ...pending }], audit_logs: [] };
  const handler = route('app/api/admin/points/route.ts', db);
  const response = await handler.PATCH(request({ id: 7, decision: 'approved' }));
  assert.equal(response.status, 200);
  assert.equal(db.audit_logs[0].payload_after.id, 7);
  assert.equal(db.audit_logs[0].payload_after.approved_by, 'admin');
  assert.equal(db.audit_logs[0].payload_after.status, 'approved');
});

test('rejections need a usable reason and invalid notes never reach storage', async () => {
  for (const notes of ['', '   ', {}, 'x'.repeat(501)]) {
    const handler = route('app/api/admin/points/route.ts', { grind_points: [], audit_logs: [] });
    const response = await handler.PATCH(request({ id: 7, decision: 'rejected', notes }));
    assert.equal(response.status, 400);
    assert.equal(handler.calls.length, 0);
  }
});

function reviewAudit() {
  return { id: 20, action: 'points.approve', target: 'Point log #7', entity_table: 'grind_points', entity_id: '7',
    is_reversible: true, reversed_at: null, undo_action: 'points.unapprove', payload_before: { ...pending }, payload_after: { ...approved } };
}

test('undo refuses to erase a newer point edit', async () => {
  const db = { grind_points: [{ ...approved, points: 50 }], audit_logs: [reviewAudit(),
    { id: 21, entity_table: 'grind_points', entity_id: '7', is_reversible: true, reversed_at: null }] };
  const handler = route('app/api/admin/audit/undo/route.ts', db);
  const response = await handler.POST(request({ auditId: 20 }));
  assert.equal(response.status, 409);
  assert.equal(db.grind_points[0].points, 50);
  assert.equal(db.grind_points[0].status, 'approved');
  assert.equal(handler.calls.some(call => call.action === 'update'), false);
});

test('undo restores an unchanged review and marks the original audit reversed', async () => {
  const db = { grind_points: [{ ...approved }], audit_logs: [reviewAudit()] };
  const handler = route('app/api/admin/audit/undo/route.ts', db);
  const response = await handler.POST(request({ auditId: 20 }));
  assert.equal(response.status, 200);
  assert.equal(db.grind_points[0].status, 'pending');
  assert.equal(db.grind_points[0].approved_at, null);
  assert.ok(db.audit_logs[0].reversed_at);
  assert.equal(db.audit_logs[1].action, 'audit.undo');
});

test('malformed undo bodies return validation errors instead of crashing', async () => {
  for (const body of [null, {}, { auditId: -1 }, { auditId: 1.5 }, { auditId: 7, reason: {} }]) {
    const handler = route('app/api/admin/audit/undo/route.ts', { grind_points: [], audit_logs: [] });
    const response = await handler.POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(handler.calls.length, 0);
  }
});


test('roster saves reject invalid member lists instead of clearing assignments', async () => {
  for (const groups of [[null], [{ teamId: 'A' }], [{ teamId: 'A', memberIds: [123] }],
    [{ teamId: 'A', memberIds: [] }, { teamId: 'A', memberIds: [] }]]) {
    const handler = route('app/api/admin/rosters/route.ts', { teams: [], team_members: [] });
    const response = await handler.PUT(request({ groups }));
    assert.equal(response.status, 400);
    assert.equal(handler.calls.length, 0);
  }
});

test('admin text validation rejects non-string names without crashing', async () => {
  for (const [file, body] of [
    ['app/api/admin/rosters/route.ts', { name: 25, schoolName: 'School', designation: 'A' }],
    ['app/api/admin/points/route.ts', { studentId: 25, label: {}, points: 50, reason: 'Correction' }],
    ['app/api/admin/custom-categories/route.ts', { name: {}, defaultPoints: 50, maxPoints: 100 }],
  ]) {
    const handler = route(file, {});
    const response = await handler.POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(handler.calls.length, 0);
  }
});


test('undo preserves notes changed after its snapshot read, including previously null notes', async () => {
  for (const originalNotes of [null, 'Original review']) {
    const original = { ...approved, notes: originalNotes };
    const db = { grind_points: [{ ...original }], audit_logs: [{ ...reviewAudit(), payload_after: { ...original } }] };
    const handler = route('app/api/admin/audit/undo/route.ts', db, {
      beforePointUpdate(database) { database.grind_points[0].notes = 'Concurrent correction'; }
    });
    const response = await handler.POST(request({ auditId: 20 }));
    assert.equal(response.status, 409);
    assert.equal(db.grind_points[0].notes, 'Concurrent correction');
    assert.equal(db.grind_points[0].status, 'approved');
    assert.equal(db.audit_logs[0].reversed_at, null);
    assert.equal(db.audit_logs.length, 1);
  }
});
