import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/paginated-query.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { loadAllPages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

for (const count of [0, 999, 1000, 1001, 2000, 2031]) {
  test(`loads all ${count} rows across the database page boundary`, async () => {
    const expected = Array.from({ length: count }, (_, id) => ({ id }));
    const calls = [];
    const result = await loadAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: expected.slice(from, to + 1), error: null };
    });
    assert.equal(result.error, null);
    assert.deepEqual(result.data, expected);
    assert.equal(calls.length, Math.floor(count / 1000) + 1);
  });
}

test("later-page failures cannot return incomplete results as a success", async () => {
  const error = { message: "Database unavailable" };
  const result = await loadAllPages(async (from) => from === 0
    ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }
    : { data: null, error });
  assert.deepEqual(result, { data: null, error });
});
