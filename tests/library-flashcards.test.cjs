const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require(name) {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }, Date, Promise, Map, Set, Number, String, JSON, URL, console });
  return module.exports;
}

const sampleEvent = { name: 'Anatomy and Physiology', slug: 'anatomy-and-physiology',
  starterPath: [], topics: [], resources: [], questions: [], tests: [] };

test('imported events have resource hubs before any library items are uploaded', async () => {
  const client = { from(table) {
    const query = { select() { return query; }, order() { return query; }, eq() { return query; },
      then(resolve) { return Promise.resolve({ data: table === 'events'
        ? [{ name: 'Integration Bee' }, { name: 'Mind Over Matter' }, { name: 'Anatomy & Physiology' }] : [], error: null }).then(resolve); } };
    return query;
  } };
  const library = load('lib/library-data.ts', {
    'server-only': {}, 'next/cache': { unstable_cache: fn => fn, revalidateTag() {} },
    '@/lib/resource-data': { sciolyEvents: [sampleEvent] },
    '@/lib/supabase': { getSupabaseAdmin: () => client, hasSupabaseAdminConfig: () => true },
  });
  for (const slug of ['integration-bee', 'mind-over-matter']) {
    const event = await library.getLibraryEvent(slug);
    assert.equal(event.slug, slug);
    assert.equal(event.resources.length, 0);
    assert.equal(event.tests.length, 0);
    assert.equal(event.coverageScore, 0);
  }
  assert.equal((await library.getLibraryEvents()).filter(event => event.slug === 'anatomy-and-physiology').length, 1);
  assert.equal(await library.getLibraryEvent('unknown-event'), undefined);
});

function flashcardRoute(file = 'app/api/flashcards/route.ts') {
  const writes = [];
  const changes = [];
  const client = { async rpc(name, values) {
    writes.push({ name, values });
    return { data: { id: 'deck', title: values.p_title, eventName: values.p_event_name, createdAt: '2026-11-10T00:00:00Z' }, error: null };
  }, from() { throw new Error('Invalid input must not access the database'); } };
  const handler = load(file, {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/auth': { getAuthenticatedStudent: async () => ({ id: 'member', name: 'Member', role: 'student' }) },
    '@/lib/analytics': { getCurrentDemoUser() {} },
    '@/lib/flashcard-data': { loadFlashcardDecks: async () => [] },
    '@/lib/flashcard-audit': { recordFlashcardChange: async change => changes.push(change) },
    '@/lib/resource-data': { sciolyEvents: [sampleEvent] },
    '@/lib/supabase': { getSupabaseAdmin: () => client, isDemoMode: () => false },
  });
  return { ...handler, writes, changes };
}
function request(body) { return { json: async () => body, headers: { get: name => name === 'content-type' ? 'application/json' : null } }; }
const deck = { title: 'Review', eventName: sampleEvent.name, cards: [{ front: 'A', back: 'one' }, { front: 'B', back: 'two' }] };

test('publishing oversized card text fails without discarding text or writing a deck', async () => {
  for (const card of [{ front: 'x'.repeat(1001), back: 'answer' }, { front: 'question', back: 'x'.repeat(5001) }]) {
    const handler = flashcardRoute();
    const response = await handler.POST(request({ ...deck, cards: [card, deck.cards[1]] }));
    assert.equal(response.status, 400);
    assert.equal(handler.writes.length, 0);
  }
});

test('valid publication preserves the whole card and announces a refresh', async () => {
  const handler = flashcardRoute();
  const front = 'x'.repeat(1000), back = 'y'.repeat(5000);
  const response = await handler.POST(request({ ...deck, cards: [{ front, back }, deck.cards[1]] }));
  assert.equal(response.status, 200);
  assert.equal(handler.writes[0].values.p_cards[0].front, front);
  assert.equal(handler.writes[0].values.p_cards[0].back, back);
  assert.equal(handler.changes[0].action, 'flashcard.publish');
});

test('null, boolean and string votes cannot silently clear or change an existing vote', async () => {
  for (const value of [null, false, true, '', '0', '1', undefined]) {
    const handler = flashcardRoute('app/api/flashcards/[id]/vote/route.ts');
    const response = await handler.POST(request({ value }), { params: Promise.resolve({ id: 'deck' }) });
    assert.equal(response.status, 400);
    assert.equal(handler.changes.length, 0);
  }
});
