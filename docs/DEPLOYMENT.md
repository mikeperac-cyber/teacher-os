# Production deployment

This project targets **Vercel** (Next.js 16) + **Supabase** (Postgres, Auth, Storage) per ADR 0001.

## Prerequisites

- Node.js 22.13+
- Supabase paid-tier project for production (free-tier pauses when idle — not suitable for learner records)
- Vercel project linked to this repository

## 1. Supabase production project

```bash
# 1. Create two Supabase projects: teacher-os-dev and teacher-os-prod (eu-north-1 recommended)
# 2. Copy .env.example to .env.local and fill from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable>
SUPABASE_SERVICE_ROLE_KEY=<service_role> # server-only
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

Apply migrations:

```bash
npx supabase link --project-ref <prod-ref>
npx supabase db push
```

Verify in dashboard: Database → Tables shows RLS enabled on every table, Storage shows 4 private buckets.

## 2. Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
# Optional email
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM

vercel --prod
```

`vercel.json` already sets the Next.js framework and build command (`npm run build`). No extra configuration is needed.

## 3. Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration, add:

- `http://localhost:3000/**`
- `https://<preview>.vercel.app/**`
- `https://<production>.vercel.app/**`

Leave **Confirm email** enabled.

## 4. Storage

Buckets are created by migrations (`0009_storage.sql`) — do not create them manually. All 4 buckets are private; downloads go through `createSignedUrl` server action after an RLS check.

## 5. Verify

```bash
npm run verify
# typecheck + lint + tests + production build
curl https://<production>/api/health
```

Expected: `{ ok: true, supabase: "configured" }`.

## 6. Post-deploy checklist

- [ ] Sign up, create workspace, create learner, schedule lesson, assign homework, submit as student, release feedback, record progress — the 8-step vertical slice.
- [ ] Upload a material (Materials → Upload) and attach it to a lesson (Lesson Planner → Attach).
- [ ] Record an assessment (Assessments → Record check / mock) — uses track-specific rubric.
- [ ] Paper submission: Homework → Record paper submission (teacher on behalf).
- [ ] Verify reports show weekly counts after delivering a lesson.
- [ ] Calendar iCal feed: `/api/calendar/ical?workspaceId=<id>` added to Google Calendar.

## 7. Rollback

Vercel retains previous deployments. To rollback:

```bash
vercel rollback
```

If a migration must be reverted, add a forward migration that reverses it — never edit a shipped migration file.

## 8. Secrets

- `SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy — Vercel env, never `NEXT_PUBLIC_*`, never committed.
- `RESEND_API_KEY` is server-only.
- OAuth client secrets for Calendar integrations belong in Supabase Vault, not env.
