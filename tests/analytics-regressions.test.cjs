require('./helpers/register-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAnalytics, demoAnalyticsDataset } = require('../lib/analytics.ts');
const { formatDate } = require('../lib/utils.ts');

function dataset() {
  return {
    students: [], teams: [], teamMembers: [], events: [{ id: 1, name: 'Experimental Design', category: 'study' }],
    tournaments: [{ ...demoAnalyticsDataset.tournaments[0], id: 1, date: '2026-11-07' }],
    performances: [], pointLogs: [], snapshots: [], auditLogs: [], testoffScores: [], now: new Date('2026-11-10T12:00:00Z')
  };
}
function student(id, name, extra = {}) {
  return { ...demoAnalyticsDataset.students[0], id, name, ...extra };
}
function performance(studentId, extra = {}) {
  return { ...demoAnalyticsDataset.performances[0], id: studentId, studentId, tournamentId: 1, eventId: 1,
    rank: 2, teamDesignation: 'A', participantNames: ['Zoe', 'Amy', 'Mia'], ...extra };
}

test('partnership names retain the correct profile IDs regardless of import order', () => {
  const data = dataset();
  data.students = [student('z', 'Zoe'), student('a', 'Amy'), student('m', 'Mia')];
  data.performances = ['z', 'm', 'a'].map((id) => performance(id));
  const insights = createAnalytics(data).getTournamentResultInsights();
  assert.equal(insights.uniqueResultCount, 1);
  assert.deepEqual(insights.partnershipSummaries[0].participantNames, ['Amy', 'Mia', 'Zoe']);
  assert.deepEqual(insights.partnershipSummaries[0].participantIds, ['a', 'm', 'z']);
});

test('uncredited, archived, and ambiguous participants do not link to another student', () => {
  const data = dataset();
  data.students = [student('z', 'Zoe'), student('a', 'Amy', { isArchived: true }), student('m1', 'Mia'), student('m2', 'Mia')];
  data.performances = ['z', 'a', 'm1', 'm2'].map((id) => performance(id, { participantNames: ['Zoe', 'Amy', 'Mia', 'Unknown'] }));
  assert.deepEqual(createAnalytics(data).getTournamentResultInsights().partnershipSummaries[0].participantIds,
    [undefined, undefined, undefined, 'z']);
});

test('thirty-day points include only approved logs inside the current time window', () => {
  const data = dataset();
  data.students = [student('a', 'Amy')];
  data.pointLogs = [
    { submittedAt: '2026-11-10T12:00:00Z', status: 'approved', points: 10 },
    { submittedAt: '2026-10-11T12:00:00Z', status: 'approved', points: 20 },
    { submittedAt: '2026-10-11T11:59:59Z', status: 'approved', points: 40 },
    { submittedAt: '2026-11-11T12:00:00Z', status: 'approved', points: 80 },
    { submittedAt: '2026-11-09T12:00:00Z', status: 'pending', points: 160 },
  ].map((log, id) => ({ id, studentId: 'a', activityType: 'solo_study', minutes: 60, ...log }));
  assert.equal(createAnalytics(data).getPlayerDetail('a').thirtyDayPoints, 30);
});

test('latest team SOS follows the tournament date, including backfilled imports', () => {
  const data = dataset();
  data.students = [student('a', 'Amy')];
  data.teams = [{ id: 'team-a', schoolName: 'School', teamDesignation: 'A', teamOvr: 0, version: 1 }];
  data.teamMembers = [{ teamId: 'team-a', studentId: 'a' }];
  data.tournaments = [
    { ...data.tournaments[0], id: 1, date: '2026-09-01', sosMultiplier: 1.1 },
    { ...data.tournaments[0], id: 2, date: '2026-11-07', sosMultiplier: 1.9 },
  ];
  data.performances = [performance('a', { id: 1, tournamentId: 1, createdAt: '2026-11-10' }),
    performance('a', { id: 2, tournamentId: 2, createdAt: '2026-11-08' })];
  assert.equal(createAnalytics(data).getTeamComparisons()[0].lastSos, 1.9);
});

test('date-only tournament dates keep their calendar day in Chicago', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    assert.equal(formatDate('2026-11-07'), 'Nov 7, 2026');
    assert.equal(formatDate('2026-11-07T02:00:00Z'), 'Nov 6, 2026');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
