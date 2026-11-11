import assert from 'node:assert/strict';
import test from 'node:test';
import { cardsFromCsv } from '../lib/flashcard-csv.ts';

test('imports BOM, reordered headers, commas, escaped quotes, and multiline answers', () => {
  assert.deepEqual(cardsFromCsv('\ufeffanswer,question\r\n"one, two",A\r\n"line 1\nline ""2""",B'), [
    { front: 'A', back: 'one, two' },
    { front: 'B', back: 'line 1\nline "2"' },
  ]);
});

test('recognizes LF, CRLF and CR row endings', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    assert.deepEqual(cardsFromCsv(['front,back', 'A,one', 'B,two'].join(newline)), [
      { front: 'A', back: 'one' }, { front: 'B', back: 'two' },
    ]);
  }
});

test('does not silently rewrite malformed quoted fields', () => {
  assert.throws(() => cardsFromCsv('front,back\nA,"answer"junk\nB,two'), /unexpected text/);
  assert.throws(() => cardsFromCsv('front,back\nA,an"swer\nB,two'), /entire CSV field/);
  assert.throws(() => cardsFromCsv('front,back\nA,"answer\nB,two'), /unclosed/);
});

test('oversized imported cards fail instead of being silently truncated on publish', () => {
  assert.throws(() => cardsFromCsv(`front,back\n${'x'.repeat(1001)},one\nB,two`), /1,000 characters/);
  assert.throws(() => cardsFromCsv(`front,back\nA,${'x'.repeat(5001)}\nB,two`), /5,000/);
});

test('incomplete cards and excess card counts are rejected', () => {
  assert.throws(() => cardsFromCsv('front,back\nA,one\nB,'), /both a front and a back/);
  assert.throws(() => cardsFromCsv('front,back\n' + Array.from({ length: 201 }, (_, i) => `${i},answer`).join('\n')), /at most 200/);
});
