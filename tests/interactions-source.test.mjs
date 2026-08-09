import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("every rendered button has a destination or state-changing handler", () => {
  const inertButtons = [...source.matchAll(/<button\b[^>]*>/gs)]
    .map((match) => match[0])
    .filter((tag) => !tag.includes("onClick") && !tag.includes('type="submit"'));

  assert.deepEqual(inertButtons, []);
});

test("workspace navigation is URL-aware and exposes detail destinations", () => {
  assert.match(source, /window\.history\[/);
  assert.match(source, /function DestinationDrawer/);
  assert.match(source, /setActiveArea\(next\.area\)/);
  assert.match(source, /Open the full .* workspace/);
});

test("primary teaching controls route to their working areas", () => {
  for (const destination of [
    'navigateTo("Lesson Planner")',
    'navigateTo("Tasks")',
    'navigateTo("Students")',
    'navigateTo("Materials")',
    'setActiveArea("Homework")',
    'setActiveArea("Assessments")',
  ]) {
    assert.ok(source.includes(destination), `missing interaction destination: ${destination}`);
  }
});
