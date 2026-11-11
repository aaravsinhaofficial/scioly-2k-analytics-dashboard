import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/testoff-input.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateTestoffInput, rankTestoffResults, shouldActivateTestoffSeason } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const valid = {
  name: "Testoff 1", date: "2026-11-10", eventId: 1, seasonId: 1,
  maxScore: 100, weight: 1, results: [{ studentId: "student-a", rawScore: 0 }]
};

test("zero is a valid score, while missing, null and text scores are rejected without dropping students", () => {
  assert.equal(validateTestoffInput(valid).data.results[0].rawScore, 0);
  for (const rawScore of [undefined, null, "", "50", false, NaN, Infinity]) {
    const result = validateTestoffInput({ ...valid, results: [...valid.results, { studentId: "student-b", rawScore }] });
    assert.equal(typeof result.error, "string");
  }
});

test("malformed payloads and result rows fail validation without throwing", () => {
  for (const input of [null, [], "test", { ...valid, name: 10 }, { ...valid, notes: {} },
    { ...valid, results: [null] }, { ...valid, results: [1] },
    { ...valid, results: [{ studentId: [], rawScore: 10 }] },
    { ...valid, results: [{ studentId: "student-a", rawScore: 10, notes: 3 }] }]) {
    assert.equal(typeof validateTestoffInput(input).error, "string");
  }
});

test("dates must exist in the calendar", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10"]) {
    assert.equal(typeof validateTestoffInput({ ...valid, date }).error, "string");
  }
  assert.ok(validateTestoffInput({ ...valid, date: "2028-02-29" }).data);
});

test("scores, weights, and maximum scores fit database precision and constraints", () => {
  for (const input of [{ maxScore: 0.0001 }, { maxScore: 1e10 }, { weight: 0.0001 }, { weight: 11 },
    { results: [{ studentId: "student-a", rawScore: -0.0001 }] },
    { results: [{ studentId: "student-a", rawScore: 101 }] }]) {
    assert.equal(typeof validateTestoffInput({ ...valid, ...input }).error, "string");
  }
  assert.equal(validateTestoffInput({ ...valid, results: [{ studentId: "student-a", rawScore: 50.12345 }] }).data.results[0].rawScore, 50.123);
});

test("ranks and ties use the actual stored score, including the rounding boundary", () => {
  const ranked = rankTestoffResults([
    { studentId: "a", rawScore: 90.00049 },
    { studentId: "b", rawScore: 90.00051 },
    { studentId: "c", rawScore: 90.00055 },
    { studentId: "d", rawScore: 0 }
  ]);
  assert.deepEqual(ranked.map(({ studentId, rawScore, rank }) => [studentId, rawScore, rank]), [
    ["b", 90.001, 1], ["c", 90.001, 1], ["a", 90, 3], ["d", 0, 4]
  ]);
});

test("duplicate students and invalid existing IDs are rejected", () => {
  assert.ok(validateTestoffInput({ ...valid, results: [valid.results[0], valid.results[0]] }).error);
  assert.ok(validateTestoffInput({ ...valid, eventId: -1, eventName: "Biology" }).error);
  assert.ok(validateTestoffInput({ ...valid, seasonId: null }).error);
});

test("entering historical testoffs preserves the active season", () => {
  assert.equal(shouldActivateTestoffSeason("2025-07-01", "2026-07-01"), false);
  assert.equal(shouldActivateTestoffSeason("2027-07-01", "2026-07-01"), true);
  assert.equal(shouldActivateTestoffSeason("2026-07-01", "2026-07-01"), true);
  assert.equal(shouldActivateTestoffSeason("2026-07-01"), true);
});
