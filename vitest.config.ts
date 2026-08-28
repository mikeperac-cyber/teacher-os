import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Test configuration.
 *
 * Vitest replaced the previous `node --test` setup because the code worth
 * testing — the triage rules in `lib/dashboard/` — is TypeScript, and the old
 * suite could only inspect `app/page.tsx` as text.
 *
 * No React plugin is needed: `tsconfig.json` sets `"jsx": "react-jsx"`, so
 * esbuild compiles JSX with the automatic runtime on its own. Adding
 * `@vitejs/plugin-react` only pulled in a second copy of Vite's types.
 *
 * Default environment is `node`, since the rules are pure functions. A test
 * needing a document opts in per file with:
 *
 *   // @vitest-environment jsdom
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
