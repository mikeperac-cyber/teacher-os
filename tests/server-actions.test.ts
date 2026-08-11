/**
 * Structural guard for `"use server"` modules.
 *
 * A `"use server"` file may only export async functions. Exporting anything
 * else — a constant, an object, even a helper that is not async — fails at
 * module evaluation with:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * This bit us once: `lib/auth/actions.ts` exported `EMPTY_AUTH_STATE`, and the
 * sign-in page crashed the moment it was rendered.
 *
 * Nothing caught it. `tsc` is happy, eslint is happy, and `next build` reports
 * success because the affected route is dynamic and therefore never evaluated
 * at build time. Even `curl` returned 200, because the Next dev error overlay
 * is served with a 200.
 *
 * So the guard has to be structural: scan the source.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SEARCH_DIRS = ["lib", "app", "components"];
const SKIP = new Set(["node_modules", ".next", ".git"]);

async function sourceFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** Exported names that are not `export async function` or `export type`. */
function offendingExports(source: string): string[] {
  const offenders: string[] = [];
  for (const line of source.split("\n")) {
    if (!line.startsWith("export ")) continue;
    // Types and interfaces are erased at compile time, so they are fine.
    if (/^export\s+(type|interface)\s/.test(line)) continue;
    if (/^export\s+async\s+function\s/.test(line)) continue;
    if (line.startsWith("export {") || line.startsWith("export *")) {
      offenders.push(line.trim());
      continue;
    }
    offenders.push(line.trim().slice(0, 70));
  }
  return offenders;
}

describe('"use server" modules', () => {
  it("export only async functions and types", async () => {
    const files: string[] = [];
    for (const dir of SEARCH_DIRS) {
      files.push(...(await sourceFiles(join(ROOT, dir))));
    }

    const problems: string[] = [];
    let serverModules = 0;

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (!/^["']use server["']/m.test(source.split("\n")[0] ?? "")) continue;
      serverModules += 1;

      for (const offender of offendingExports(source)) {
        problems.push(`${file.replace(ROOT, "")}: ${offender}`);
      }
    }

    // If this hits zero the scan has silently stopped finding anything, and the
    // guard would pass for the wrong reason.
    expect(serverModules).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
