import type { ActivityType } from "@/lib/types";

export const activityLabels: Record<ActivityType, string> = {
  solo_study: "Solo Study",
  partner_study: "Partner Study",
  solo_practice_test: "Solo Practice Test",
  partner_practice_test: "Partner Practice Test",
  build_testing: "Build Testing",
  id_specimens: "ID Specimens"
};

export const activityLimits = {
  maxStudyMinutes: 240,
  maxSpecimenCount: 300,
  maxCustomBuildPoints: 200,
  maxPointsPerLog: 200
};

export const activityHelp: Record<ActivityType, string> = {
  solo_study: `minutes x 0.75, capped at ${activityLimits.maxPointsPerLog} pts`,
  partner_study: `minutes x 1.0, capped at ${activityLimits.maxPointsPerLog} pts`,
  solo_practice_test: "100 points flat",
  partner_practice_test: "150 points flat",
  build_testing: `custom session points, capped at ${activityLimits.maxCustomBuildPoints} pts`,
  id_specimens: `quantity x 0.5, capped at ${activityLimits.maxPointsPerLog} pts`
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function calculateActivityPoints(input: {
  activityType: ActivityType;
  minutes?: number;
  quantity?: number;
  customPoints?: number;
}) {
  const minutes = clamp(Number(input.minutes ?? 0), 0, activityLimits.maxStudyMinutes);
  const quantity = clamp(Number(input.quantity ?? 0), 0, activityLimits.maxSpecimenCount);
  const customPoints = clamp(Number(input.customPoints ?? 0), 0, activityLimits.maxCustomBuildPoints);

  switch (input.activityType) {
    case "solo_study":
      return Math.min(activityLimits.maxPointsPerLog, Math.round(minutes * 0.75));
    case "partner_study":
      return Math.min(activityLimits.maxPointsPerLog, Math.round(minutes));
    case "solo_practice_test":
      return 100;
    case "partner_practice_test":
      return 150;
    case "build_testing":
      return Math.min(activityLimits.maxPointsPerLog, Math.round(customPoints));
    case "id_specimens":
      return Math.min(activityLimits.maxPointsPerLog, Math.round(quantity * 0.5));
    default:
      return 0;
  }
}
