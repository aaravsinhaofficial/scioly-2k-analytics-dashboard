import assert from 'node:assert/strict';
import test from 'node:test';
import { isCorrectMcqAnswer, normalizeAnswers, normalizeReviews, score } from '../lib/practice-scoring.ts';

const questions = [
  { id: 1, type: 'mcq', prompt: 'A', options: ['first', 'second'], correctOption: 0, points: 2, position: 0 },
  { id: 2, type: 'mcq', prompt: 'B', options: ['first', 'second'], correctOption: 1, points: 3, position: 1 },
  { id: 3, type: 'frq', prompt: 'Explain', options: [], points: 5, position: 2 },
];

test('empty, null, boolean, array and string MCQ inputs remain unanswered', () => {
  for (const invalid of [undefined, null, false, true, '', ' ', '0', [], {}, -1, 2, 0.5]) {
    const answers = normalizeAnswers({ 1: invalid }, questions);
    assert.deepEqual(answers, {});
    assert.equal(score(questions, answers, {}).earnedPoints, 0);
  }
});

test('option zero is retained and earns credit, while missing answers do not', () => {
  const answers = normalizeAnswers({ 1: 0, 2: 1, 3: 'A supported explanation', 999: 0 }, questions);
  assert.deepEqual(answers, { 1: 0, 2: 1, 3: 'A supported explanation' });
  assert.deepEqual(score(questions, answers, { 3: 'partial' }), {
    mcqCorrect: 2, mcqTotal: 2, earnedPoints: 7.5, maxPoints: 10,
  });
  assert.equal(isCorrectMcqAnswer({ ...questions[0], correctOption: undefined }, undefined), false);
});

test('reviews are limited to known FRQs and valid ratings', () => {
  assert.deepEqual(normalizeReviews({ 1: 'correct', 3: 'partial', 999: 'correct' }, questions), { 3: 'partial' });
  assert.deepEqual(normalizeReviews({ 3: 'excellent' }, questions), {});
});

test('FRQ responses are bounded without accepting non-text answers', () => {
  assert.equal(normalizeAnswers({ 3: 'x'.repeat(20001) }, questions)['3'].length, 20000);
  assert.deepEqual(normalizeAnswers({ 3: 1 }, questions), {});
});
