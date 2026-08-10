import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    /**
     * Pin the workspace root to this directory.
     *
     * Without this, Turbopack walks up looking for a lockfile and finds a stray
     * `package-lock.json` in the user's home folder, then treats that as the
     * project root. That silently widens file tracing and would produce a wrong
     * bundle on deploy.
     */
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
