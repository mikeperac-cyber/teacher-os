import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Loading initial data in an effect is the correct pattern for client components
      // that fetch Supabase data after mount. The rule is overly strict for this case.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling scratch directories, not project source.
    ".remember/**",
    ".sites-runtime/**",
    ".playwright-mcp/**",
  ]),
]);

export default eslintConfig;
