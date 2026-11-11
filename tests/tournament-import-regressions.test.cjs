require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTournamentInput } = require('../lib/tournament-import.ts');
const { resolveTournamentParticipants } = require('../lib/tournament-participant-resolution.ts');
const localSchoolName = 'Obra D Tompkins High School';
const candidates = [{ id: 'amy', name: 'Amy', teamDesignation: 'A', profileEvents: ['Astronomy'] }];
function resolve(preview, selections) {
  return resolveTournamentParticipants({ preview, candidates, selections, localSchoolName,
    isLocalSchool: (name) => name === localSchoolName });
}

test('invalid ranks cannot turn into positive placements during CSV parsing', async () => {
  const preview = await parseTournamentInput(`Event,Rank,School,Team,Students\nAstronomy,-1,${localSchoolName},A,Amy\nAstronomy,1.5,${localSchoolName},A,Amy\nAstronomy,0,${localSchoolName},A,Amy\nAstronomy,3rd,${localSchoolName},A,Amy`, { date: '2026-11-07' });
  assert.deepEqual(preview.performances.map((row) => row.rank), [3]);
  assert.equal(preview.warnings.filter((warning) => warning.includes('not a positive whole number')).length, 3);
});

test('a zero CSV medal cutoff suppresses medals instead of falling back to six', async () => {
  const preview = await parseTournamentInput(`Event,Rank,School,Team,Students,MedalCutoff\nAstronomy,1,${localSchoolName},A,Amy,0`, { date: '2026-11-07' });
  assert.equal(preview.performances[0].medalCutoff, 0);
  assert.equal(preview.performances[0].isMedal, false);
  assert.equal(preview.performances[0].medalPoints, 0);
});

test('invalid calendar dates block imports instead of silently rolling forward', async () => {
  for (const date of ['2026-02-30', '13/01/2026', 'not a date']) {
    const preview = await parseTournamentInput(`Event,Rank,School,Team,Students\nAstronomy,1,${localSchoolName},A,Amy`, { date });
    assert.equal(resolve(preview).canCommit, false, date);
    assert.ok(preview.missingFields.includes('Enter a valid tournament date.'));
  }
  const valid = await parseTournamentInput(`Event,Rank,School,Team,Students\nAstronomy,1,${localSchoolName},A,Amy`, { date: '2/28/26' });
  assert.equal(valid.date, '2026-02-28');
  assert.equal(resolve(valid).canCommit, true);
});

test('missing-school rows require confirmation and retain it in committed preview', async () => {
  const preview = await parseTournamentInput('Event,Rank,Team,Students\nAstronomy,1,A,Amy', { date: '2026-11-07' });
  const initial = resolve(preview);
  assert.equal(initial.canCommit, false);
  assert.equal(initial.performances[0].participantResolution.status, 'needs_confirmation');
  const confirmed = resolve(preview, { 'csv-2': { studentIds: ['amy'], confirmed: true } });
  assert.equal(confirmed.canCommit, true);
  assert.equal(confirmed.performances[0].schoolName, localSchoolName);
  assert.equal(confirmed.performances[0].participantResolution.status, 'matched');
});

test('confirming a local row never credits a result from another school', async () => {
  const preview = await parseTournamentInput('Event,Rank,School,Team,Students\nAstronomy,1,Other School,A,Amy', { date: '2026-11-07' });
  const confirmed = resolve(preview, { 'csv-2': { studentIds: ['amy'], confirmed: true } });
  assert.equal(confirmed.performances[0].schoolName, 'Other School');
  assert.equal(confirmed.performances[0].participantResolution.status, 'external');
  assert.deepEqual(confirmed.performances[0].participantResolution.selected, []);
});
