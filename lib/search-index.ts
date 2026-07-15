import "server-only";

import { sciolyEvents, type SciolyEventHub } from "@/lib/resource-data";
import type { SearchDirectory } from "@/lib/search-directory";
import type { SearchCandidate, SearchResult } from "@/lib/search-types";
import { libraryContentAnchor, scoreSearchCandidate } from "@/lib/search-utils";

function rankedResults(candidates: SearchCandidate[], query: string, limit: number): SearchResult[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreSearchCandidate(candidate, query) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map(({ keywords: _keywords, minimumRole: _minimumRole, quickRank: _quickRank, ...result }) => result);
}

export function searchResourceContent(query: string, events: SciolyEventHub[] = sciolyEvents) {
  const candidates: SearchCandidate[] = [];

  for (const event of events) {
    candidates.push({
      id: `event:${event.slug}`,
      kind: "event",
      group: "Events",
      title: event.name,
      subtitle: `${event.isTrial ? "Featured trial" : `${event.category} event`} · ${event.resources.length} resources · ${event.questions.length + event.tests.length} practice items`,
      href: `/resources/${event.slug}`,
      keywords: [event.tagline, event.description, event.category, event.season ? String(event.season) : "", event.isTrial ? "featured trial" : "scored event", ...event.topics, ...event.starterPath]
    });

    for (const resource of event.resources) {
      const anchor = libraryContentAnchor(resource.title, resource.libraryId);
      candidates.push({
        id: `resource:${event.slug}:${anchor}`,
        kind: "resource",
        group: "Resources",
        title: resource.title,
        subtitle: `${event.name} · ${resource.type} · ${resource.topic}`,
        href: `/resources/${event.slug}#resource-${anchor}`,
        keywords: [event.name, resource.description, resource.difficulty, resource.topic, resource.type, resource.body ?? "", resource.url ?? ""]
      });
    }

    for (const question of event.questions) {
      const anchor = libraryContentAnchor(question.question, question.libraryId);
      candidates.push({
        id: `question:${event.slug}:${anchor}`,
        kind: "question",
        group: "Practice",
        title: question.question,
        subtitle: `${event.name} · ${question.topic} · ${question.difficulty}`,
        href: `/resources/${event.slug}#question-${anchor}`,
        keywords: [event.name, question.topic, question.answer, question.explanation, question.difficulty]
      });
    }

    for (const test of event.tests) {
      const anchor = libraryContentAnchor(test.title, test.libraryId);
      candidates.push({
        id: `test:${event.slug}:${anchor}`,
        kind: "test",
        group: "Practice",
        title: test.title,
        subtitle: `${event.name} · ${test.format} · ${test.difficulty}`,
        href: test.libraryId ? `/practice/tests/${test.libraryId}` : `/resources/${event.slug}#test-${anchor}`,
        keywords: [event.name, test.description, test.format, test.difficulty, test.body ?? "", test.url ?? ""]
      });
    }
  }

  return rankedResults(candidates, query, 12);
}

export function searchDirectoryContent(directory: SearchDirectory, query: string) {
  const teamById = new Map(directory.teams.map((team) => [team.id, team]));
  const teamIdByStudent = new Map(directory.memberships.map((membership) => [membership.studentId, membership.teamId]));
  const membersByTeam = new Map<string, typeof directory.students>();
  const studentById = new Map(directory.students.map((student) => [student.id, student]));

  for (const membership of directory.memberships) {
    const student = studentById.get(membership.studentId);
    if (!student) continue;
    const members = membersByTeam.get(membership.teamId);
    if (members) members.push(student);
    else membersByTeam.set(membership.teamId, [student]);
  }

  const students: SearchCandidate[] = directory.students.map((student) => {
    const team = teamById.get(teamIdByStudent.get(student.id) ?? "");
    const eventSummary = student.profileEvents.slice(0, 2).join(", ");
    return {
      id: `student:${student.id}`,
      kind: "student",
      group: "Students",
      title: student.name,
      subtitle: `${team ? `Team ${team.designation}` : "Unassigned"} · Grade ${student.grade}${eventSummary ? ` · ${eventSummary}` : ""}`,
      href: `/profile/${student.id}`,
      keywords: [String(student.grade), team?.designation ?? "", team?.schoolName ?? "", ...student.profileEvents]
    };
  });

  const teams: SearchCandidate[] = directory.teams.map((team) => {
    const members = membersByTeam.get(team.id) ?? [];
    return {
      id: `team:${team.id}`,
      kind: "team",
      group: "Teams",
      title: `Team ${team.designation}`,
      subtitle: `${team.schoolName} · ${members.length} member${members.length === 1 ? "" : "s"}`,
      href: `/teams?team=${encodeURIComponent(team.designation)}`,
      keywords: [team.schoolName, team.designation, "roster", ...members.map((member) => member.name), ...members.flatMap((member) => member.profileEvents)]
    };
  });

  const testoffs: SearchCandidate[] = directory.testoffs.map((session) => ({
    id: `testoff:${session.id}`,
    kind: "testoff",
    group: "Testoffs",
    title: session.name,
    subtitle: `${session.eventName} · ${session.seasonName} · ${session.date}`,
    href: `/testoffs?season=${session.seasonId}&event=${session.eventId}#testoff-session-${session.id}`,
    keywords: ["testoff", "session", session.eventName, session.seasonName, session.date]
  }));

  return [
    ...rankedResults(students, query, 6),
    ...rankedResults(teams, query, 3),
    ...rankedResults(testoffs, query, 5)
  ];
}
