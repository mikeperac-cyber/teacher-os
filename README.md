# Teacher OS

Claude-ready source export of the existing Teacher OS interface.

Export date: 10 August 2026  
Source version: Teacher OS version 4  
Visual reference: https://teacher-os.mike487612.chatgpt.site

The live ChatGPT Sites deployment was not modified during this export. This
package is an independent copy and contains no live-site identifier,
credentials, dependency folder, build output, or Git history.

## Current product state

- Desktop-first productivity interface for a private 1:1 ESL and IELTS
  Academic teacher.
- Separate ESL and IELTS navigation, dashboards, progress views, assessments,
  homework and lesson-planning experiences.
- Shared Calendar, Tasks, Goals, Projects, Reports and Materials areas.
- URL-aware navigation and working interface controls.
- Demonstration data is hard-coded in `app/page.tsx`.
- Changes made through the interface are React state only and reset after a
  refresh.
- `db/schema.ts` is intentionally empty. There is no production database or
  application-owned authentication yet.

Read [CLAUDE.md](CLAUDE.md) and the files in [docs](docs) before making changes.

## Technology in this export

- Next.js 16 App Router
- React 19 and TypeScript
- Vinext/Vite targeting a Cloudflare Worker
- Tailwind PostCSS tooling and custom CSS
- Drizzle ORM scaffold for optional Cloudflare D1
- Lucide React icons

The application UI is concentrated in:

- `app/page.tsx` — product data, views and interactions
- `app/globals.css` — full visual system
- `app/layout.tsx` — metadata and fonts

## Start locally

Node.js 22.13 or newer is required. On Windows, use WSL 2 because the existing
Sites build helpers use Linux shell utilities.

```bash
npm ci
npm run dev
```

Run the current verification suite with:

```bash
npm test
```

## Continue with Claude Code

1. Extract this ZIP.
2. Put the folder in a new private GitHub repository.
3. Open the folder in Cursor or Claude Code.
4. Ask Claude to read `CLAUDE.md` and `docs/CURRENT_STATE.md`.
5. Begin with the audit prompt in `docs/FIRST_CLAUDE_PROMPT.md`.
6. Commit the untouched export before implementing the database migration.

Do not reconnect this copy to the existing ChatGPT Sites project. Keep the
current deployment as a visual reference until the production replacement has
passed authentication, permissions and data-isolation testing.

