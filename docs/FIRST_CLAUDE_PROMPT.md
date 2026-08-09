# First prompt for Claude

Copy the prompt below into Claude Code after opening this repository.

```text
Read CLAUDE.md and every file in docs/ before making changes.

This repository is an exported working frontend for Teacher OS. Preserve its
visual design and existing interactions. The current data is simulated and the
database schema is empty.

First perform a read-only repository audit. Report:

1. The current runtime, build system and deployment-specific code.
2. All hard-coded data sources and non-persistent React state.
3. The component boundaries you recommend extracting without changing
   behavior.
4. The safest choice between retaining the Cloudflare/Vinext runtime and
   migrating to standard Next.js on Vercel.
5. The proposed Supabase schema, SQL migration order and RLS policy matrix.
6. A test plan for owner, teacher and student access.
7. A phased implementation plan beginning with the complete
   lesson-to-homework-to-progress vertical slice.

Product requirements:

- ESL and IELTS Academic remain separate tracking systems and dashboards.
- Shared operational tools may be reused across tracks.
- Students can access only their own permitted data.
- Core reportable fields are strongly typed.
- Custom fields and reusable rubric templates are supported.
- Do not perform a broad UI rewrite.
- Do not modify files until the audit, architecture decision and first-phase
  file plan are presented.
```

