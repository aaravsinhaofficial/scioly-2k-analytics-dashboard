require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatReportGeneratedAt } = require('../lib/report-time.ts');

test('report timestamps use the Chicago date and daylight-saving offset with an explicit CT label', () => {
  assert.equal(formatReportGeneratedAt('2026-11-11T05:00:00Z'), 'Nov 10, 2026, 11:00 PM CT');
  assert.equal(formatReportGeneratedAt('2026-07-11T05:00:00Z'), 'Jul 11, 2026, 12:00 AM CT');
});
