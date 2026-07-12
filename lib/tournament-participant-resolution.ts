import type { TournamentImportPreview, TournamentParticipantCandidate } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export interface ParticipantSelection {
  studentIds: string[];
  confirmed: boolean;
}

export function resolveTournamentParticipants(input: {
  preview: TournamentImportPreview;
  candidates: TournamentParticipantCandidate[];
  selections?: Record<string, ParticipantSelection>;
  isLocalSchool: (schoolName: string) => boolean;
}) {
  const blockers: string[] = [...input.preview.missingFields];
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));

  const performances = input.preview.performances.map((performance) => {
    if (performance.schoolName && !input.isLocalSchool(performance.schoolName)) {
      return {
        ...performance,
        participantResolution: {
          status: "external" as const,
          method: "none" as const,
          selected: [],
          candidates: [],
          unmatchedSourceNames: performance.studentNames,
          issues: ["Other-school result; used only for field strength."]
        }
      };
    }

    const issues: string[] = [];
    const normalizedEvent = normalizeName(performance.eventName);
    const sameTeam = performance.teamDesignation
      ? input.candidates.filter((candidate) => candidate.teamDesignation === performance.teamDesignation)
      : input.candidates;
    const eventCandidates = sameTeam.filter((candidate) =>
      candidate.profileEvents.some((event) => normalizeName(event) === normalizedEvent)
    );
    const selection = input.selections?.[performance.rowKey];

    if (!performance.schoolName) issues.push("School is missing; confirm that this is a Tompkins result.");
    if (!performance.teamDesignation) issues.push("Team designation is missing.");

    if (selection?.confirmed) {
      const selected = Array.from(new Set(selection.studentIds)).flatMap((id) => {
        const candidate = candidateById.get(id);
        return candidate ? [candidate] : [];
      });
      if (selected.length !== new Set(selection.studentIds).size || selected.length === 0) {
        blockers.push(`${performance.eventName}: choose at least one valid team member.`);
        return {
          ...performance,
          participantResolution: {
            status: "unresolved" as const,
            method: "none" as const,
            selected,
            candidates: eventCandidates.length > 0 ? eventCandidates : sameTeam,
            unmatchedSourceNames: performance.studentNames,
            issues: [...issues, "The confirmed participant selection is invalid."]
          }
        };
      }
      for (const candidate of selected) {
        if (performance.teamDesignation && candidate.teamDesignation !== performance.teamDesignation) {
          issues.push(`${candidate.name} is currently on Team ${candidate.teamDesignation}, not Team ${performance.teamDesignation}.`);
        }
        if (!candidate.profileEvents.some((event) => normalizeName(event) === normalizedEvent)) {
          issues.push(`${candidate.name} does not currently list ${performance.eventName}.`);
        }
      }
      return {
        ...performance,
        studentNames: selected.map((candidate) => candidate.name),
        studentName: selected.map((candidate) => candidate.name).join(", "),
        participantResolution: {
          status: "matched" as const,
          method: "manual_override" as const,
          selected,
          candidates: eventCandidates.length > 0 ? eventCandidates : sameTeam,
          unmatchedSourceNames: [],
          issues
        }
      };
    }

    if (performance.studentNames.length > 0) {
      const selected: TournamentParticipantCandidate[] = [];
      const unmatchedSourceNames: string[] = [];
      for (const sourceName of performance.studentNames) {
        const matches = input.candidates.filter((candidate) => normalizeName(candidate.name) === normalizeName(sourceName));
        if (matches.length === 1) selected.push(matches[0]);
        else unmatchedSourceNames.push(sourceName);
      }
      if (unmatchedSourceNames.length === 0 && selected.length === performance.studentNames.length) {
        return {
          ...performance,
          studentNames: selected.map((candidate) => candidate.name),
          participantResolution: {
            status: "matched" as const,
            method: "provided_exact" as const,
            selected,
            candidates: eventCandidates,
            unmatchedSourceNames: [],
            issues
          }
        };
      }
      blockers.push(`${performance.eventName}: confirm the participant match.`);
      return {
        ...performance,
        participantResolution: {
          status: eventCandidates.length > 0 ? "needs_confirmation" as const : "unresolved" as const,
          method: eventCandidates.length > 0 ? "roster_event_suggestion" as const : "none" as const,
          selected: eventCandidates,
          candidates: eventCandidates.length > 0 ? eventCandidates : sameTeam,
          unmatchedSourceNames,
          issues: [...issues, "One or more imported names did not match exactly."]
        }
      };
    }

    blockers.push(`${performance.eventName}: confirm who competed for Team ${performance.teamDesignation || "?"}.`);
    return {
      ...performance,
      participantResolution: {
        status: eventCandidates.length > 0 ? "needs_confirmation" as const : "unresolved" as const,
        method: eventCandidates.length > 0 ? "roster_event_suggestion" as const : "none" as const,
        selected: eventCandidates,
        candidates: eventCandidates.length > 0 ? eventCandidates : sameTeam,
        unmatchedSourceNames: [],
        issues: eventCandidates.length > 0
          ? [...issues, `Suggested from current Team ${performance.teamDesignation} members assigned to ${performance.eventName}.`]
          : [...issues, "No current team member is assigned to this event."]
      }
    };
  });

  const credited = new Map<string, string>();
  for (const performance of performances) {
    if (performance.participantResolution?.status !== "matched") continue;
    for (const candidate of performance.participantResolution.selected) {
      const key = `${candidate.id}:${normalizeName(performance.eventName)}`;
      const prior = credited.get(key);
      if (prior && prior !== performance.rowKey) blockers.push(`${candidate.name} is matched to ${performance.eventName} more than once.`);
      credited.set(key, performance.rowKey);
    }
  }

  return {
    ...input.preview,
    performances,
    blockers: Array.from(new Set(blockers)),
    canCommit: blockers.length === 0
  };
}
