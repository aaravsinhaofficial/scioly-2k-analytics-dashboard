require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { activityInputError, calculateActivityPoints } = require('../lib/activity.ts');

test('practice submissions validate the same whole-number bounds as database storage', () => {
  for (const input of [{ minutes: 241 }, { minutes: 1.5 }, { quantity: 301 }, { quantity: -1 }, { customPoints: 501 }, { minutes: '60' }, { quantity: null }]) {
    assert.ok(activityInputError(input));
  }
  for (const input of [{}, { minutes: 240, quantity: 300, customPoints: 500 }, { minutes: 0, quantity: 0 }]) {
    assert.equal(activityInputError(input), null);
  }
});

test('valid boundary practice inputs retain their published point awards', () => {
  assert.equal(calculateActivityPoints({ activityType: 'solo_study', minutes: 240 }), 180);
  assert.equal(calculateActivityPoints({ activityType: 'partner_study', minutes: 240 }), 200);
  assert.equal(calculateActivityPoints({ activityType: 'id_specimens', quantity: 300 }), 150);
  assert.equal(calculateActivityPoints({ activityType: 'build_testing', customPoints: 500 }), 200);
});
