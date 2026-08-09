# Current-state audit

## What already works

- ESL and IELTS workspace switching.
- Separate track navigation and dashboard content.
- URL-aware navigation using `track`, `view` and `detail` parameters.
- Browser back/forward restoration for workspace views.
- Global search overlay and keyboard shortcut.
- Quick-add menu, detail drawers, lesson drawer and notifications.
- Calendar view switching and week navigation.
- Task completion, filtering and sorting during the current session.
- Materials search and skill filtering.
- Click handlers are present on every rendered button.

## What is simulated

- Students, lessons, schedules, homework, assessments, materials and reports.
- Creating a record only changes drawer state.
- Task completion and lesson checklist updates reset after refresh.
- Search operates on in-file demonstration records.
- Dashboard metrics and progress graphs are static.
- No files are uploaded or downloaded.
- No email, calendar or notification service is connected.

## Technical concentration

- `app/page.tsx`: approximately 1,210 lines.
- `app/globals.css`: approximately 780 lines.
- `db/schema.ts`: no tables.
- Most domain data is declared as constants above the page component.
- Most destinations are views rendered inside one client-side route.

## Migration cautions

- Preserve the current URL behavior while introducing real routes or data.
- Extract domain modules gradually; a full first-pass rewrite would make
  visual and interaction regressions difficult to identify.
- Do not infer authorization from the selected ESL/IELTS tab.
- Do not use one generic progress table for both tracks.
- Do not treat toast messages or a saved drawer state as successful database
  writes.
- Keep the baseline interaction tests and add integration and permission tests.

## Verified baseline

The exported source passed its existing production build and four automated
tests immediately before packaging.

