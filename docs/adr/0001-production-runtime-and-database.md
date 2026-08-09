# ADR 0001 — Production runtime and database

- **Status:** Accepted
- **Date:** 10 August 2026
- **Decision maker:** Mike Darcy (owner)
- **Supersedes:** nothing
- **Required by:** `CLAUDE.md` § "Recommended production direction", which mandates
  this decision before the Vinext/Cloudflare build is changed, and requires that
  exactly one production runtime be maintained.

## Context

The repository is a source export of Teacher OS version 4, taken from a ChatGPT
Sites deployment. A read-only audit on 10 August 2026 established the following
facts, which are the basis of this decision.

**The Cloudflare runtime is an export artifact, not a chosen architecture.**

- `.openai/hosting.json` contains `{"d1": null, "project_id": null, "r2": null}`.
  No database and no object storage were ever bound.
- `db/schema.ts` declares no tables. `drizzle/meta/_journal.json` has an empty
  `entries` array. `db/index.ts` throws if called.
- There is therefore **no production data, no live schema, and no deployed
  Cloudflare environment to preserve**. The `examples/d1/` directory is an
  opt-in reference that nothing imports.
- `README.md` explicitly forbids reconnecting this copy to the existing ChatGPT
  Sites project, so the packaging pipeline it targets
  (`.openai/hosting.json`, `scripts/validate-artifact.sh`) has no forward value.

**The build is a pre-1.0 third-party toolchain.**

- `vinext@0.0.50` is an independent reimplementation of the Next.js App Router
  on Vite. `next.config.ts` is an empty stub and the Next.js CLI is never
  invoked; `next` is present only as a library dependency.
- The application has exactly one route (`/`), no `app/api`, no middleware, no
  server actions, and no dynamic segments. The entire UI is a single 1,210-line
  `"use client"` component.

**The export already anticipates the alternative.**

- `.env.example` declares `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
  `NEXT_PUBLIC_SITE_URL`. Nothing in the codebase consumes them.
- `.gitignore` already ignores `.vercel`.

**The build is hostile to the owner's machine.** `npm run build` requires bash
and GNU `timeout`; `README.md` directs Windows users to WSL 2. The owner works
on Windows 11.

## Decision

**Migrate to the standard Next.js App Router deployed on Vercel, with Supabase
providing Postgres, Auth and Storage.** The Vinext/Vite/Cloudflare Worker
pipeline is retired, not extended.

## Rationale

1. **Authentication correctness outweighs build continuity.** `@supabase/ssr`
   refreshes sessions through Next.js middleware and reads and writes cookies
   through server-component APIs. That is precisely the layer where a pre-0.1
   App Router reimplementation is most likely to differ subtly from the real
   one, and precisely the layer where a subtle difference becomes an
   authorization defect. This application will hold minors' learning records.

2. **Migration cost is unusually low, and only rises from here.** One route, no
   server code, no live data, no users. Every phase deferred adds application
   surface that would have to be ported later.

3. **Retaining Cloudflare would violate the one-runtime rule in practice.**
   Supabase Postgres alongside a Drizzle/D1 SQLite scaffold, `.openai` hosting
   manifests and R2 bindings is two persistence stories in one repository. That
   is the outcome `CLAUDE.md` prohibits.

4. **The toolchain tax is paid on every phase.** Removing the bash + GNU
   `timeout` + WSL 2 dependency makes local development, testing and CI
   materially simpler for a solo maintainer on Windows.

5. **The destination is already declared.** Supabase environment variables and a
   `.vercel` ignore entry were shipped in the export.

## Alternatives considered

**Retain Cloudflare Workers + Vinext, add Supabase.** Rejected. Its principal
benefit — preserving an existing deployment pipeline — does not apply, because
the pipeline targets a platform the README forbids reconnecting to, and because
no Cloudflare production environment exists. Cloudflare Workers remain a sound
runtime in general; the objection is specific to running Supabase session
handling on `vinext@0.0.50` and to carrying unused D1/R2 scaffolding.

**Defer via a spike on both runtimes.** Rejected as poor value. The decisive
facts (null bindings, empty schema, no deployment, pre-0.1 dependency) were
already established by static audit; a spike would cost roughly a day to
re-confirm them.

## Consequences

**Removed in Phase 1**, with no functional loss because none of it is reachable:

| Path | Reason |
| --- | --- |
| `worker/index.ts` | Cloudflare Worker entry point |
| `build/sites-vite-plugin.ts` | Packages `.openai` metadata for ChatGPT Sites |
| `scripts/*.sh` | Sites build/validation wrappers; require bash + GNU `timeout` |
| `.openai/` | Sites hosting manifest; all bindings null |
| `db/`, `drizzle/`, `drizzle.config.ts` | Drizzle scaffold configured for SQLite/D1, not Postgres |
| `examples/d1/` | D1 reference example; imported by nothing |
| `.vinext/` | next/font build cache produced by Vinext |
| `vite.config.ts` | Replaced by standard Next.js build |
| `app/chatgpt-auth.ts` | Derives identity from unsigned request headers — see below |

Dependencies dropped: `vinext`, `vite`, `@vitejs/plugin-react`,
`@vitejs/plugin-rsc`, `react-server-dom-webpack`, `@cloudflare/vite-plugin`,
`wrangler`, `drizzle-orm`, `drizzle-kit`.

**Security note.** `app/chatgpt-auth.ts` reads user identity from the
`oai-authenticated-user-email` request header. It is currently imported by
nothing and is therefore inert, but it constitutes a complete authentication
bypass if revived outside the proxy that was expected to set that header. It is
deleted rather than adapted.

**Both existing tests are retired, not repaired.**
`tests/rendered-html.test.mjs` boots `dist/server/index.js` as a Cloudflare
Worker and asserts a `codex-preview` meta tag specific to the Sites preview.
`tests/interactions-source.test.mjs` is a regular-expression scan over the text
of `app/page.tsx`; it breaks as soon as components are extracted and provides
weak evidence regardless. Both are replaced with DOM-level tests in Phase 1 and
an RLS permission suite in Phase 2.

**Unaffected.** `app/globals.css` (780 lines) transfers verbatim: it is
class-based CSS with no Tailwind utility classes in markup and no CSS-in-JS. The
`.track-esl` / `.track-ielts` custom-property theming is retained as the
mechanism keeping the ESL and IELTS workspaces visually distinct. The
`?track=…&view=…&detail=…` URL contract is preserved.

**Accepted risks.**

- Vercel and Supabase introduce vendor coupling. Mitigated by keeping business
  logic in server-side application code and schema in portable SQL migrations
  under version control.
- Supabase free-tier projects pause when idle; production must be on a paid
  tier before real student data is entered.
- Postgres Row Level Security becomes the primary authorization boundary. It is
  therefore tested directly at the database layer with per-role authenticated
  clients, never through the UI and never with the service-role key.

## Constraints this decision does not relax

Carried unchanged from `CLAUDE.md`:

- ESL and IELTS Academic remain separate tracking systems, dashboards,
  navigation areas, progress models, assessments and reports. No shared generic
  score.
- Authorization is enforced in the database and on the server, never by hidden
  UI, and never inferred from the selected ESL/IELTS track.
- The Supabase service-role key is server-only and never reaches a client
  bundle.
- The existing visual design is preserved.
