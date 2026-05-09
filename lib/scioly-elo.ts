import type { SchoolElo } from "@/lib/types";
import { calculateSos, resolveBenchmarkComparison } from "@/lib/rating";

const fallbackElos: Record<string, number> = {
  "Obra D Tompkins High School": 1785,
  "Seven Lakes High School": 2100,
  "Solon High School": 2250,
  "Mason High School": 2185,
  "Troy High School": 2140,
  "Clements High School": 1860,
  "Cinco Ranch High School": 1725,
  "Cy Falls High School": 1510,
  "LASA High School": 1940,
  "Westlake High School": 1810,
  "Dulles High School": 1435,
  "Cypress Ranch High School": 1490,
  "Pearland High School": 1375,
  "Baseline School": 1000
};

export async function fetchSchoolElo(schoolName: string): Promise<SchoolElo> {
  const endpoint = process.env.SCIOLY_ELO_ENDPOINT;

  if (endpoint) {
    try {
      const response = await fetch(`${endpoint}?school=${encodeURIComponent(schoolName)}`, {
        next: { revalidate: 60 * 60 * 24 }
      });

      if (response.ok) {
        const payload = (await response.json()) as { elo?: number };
        if (typeof payload.elo === "number") {
          return { schoolName, elo: payload.elo };
        }
      }
    } catch {
      // Fallback below keeps tournament import usable during local demos.
    }
  }

  return { schoolName, elo: fallbackElos[schoolName] ?? 1000 };
}

export async function resolveSchoolsWithSos(schoolNames: string[]) {
  const uniqueSchools = Array.from(new Set(schoolNames.filter(Boolean)));
  const attendingSchools = await Promise.all(uniqueSchools.map((schoolName) => fetchSchoolElo(schoolName)));
  const sosMultiplier = calculateSos(attendingSchools.map((school) => school.elo));
  const avgSciolyElo =
    attendingSchools.length === 0
      ? 1000
      : Math.round(attendingSchools.reduce((total, school) => total + school.elo, 0) / attendingSchools.length);
  const benchmarkComparison = resolveBenchmarkComparison(attendingSchools, avgSciolyElo, sosMultiplier);

  return {
    attendingSchools,
    sosMultiplier,
    avgSciolyElo,
    benchmarkComparison
  };
}
