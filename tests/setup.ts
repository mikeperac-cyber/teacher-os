import { vi } from "vitest";

// Prevent `server-only` from throwing when a client component (tested in jsdom)
// transitively imports a server file via a server action. In Next.js this is
// allowed because server actions are RPC, but vitest does a plain Node import.
vi.mock("server-only", () => ({}));
