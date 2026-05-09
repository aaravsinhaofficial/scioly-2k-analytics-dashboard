# SciOly 2K Analytics Dashboard

Local implementation of the SciOly 2K Analytics Dashboard for **Obra D Tompkins High School**.

## What Is Included

- Next.js 15 App Router with TypeScript
- Tailwind 2K-style dark UI with tier-colored OVR badges
- Dashboard leaderboard with sortable roster columns and player deep-dive modal
- Profile pages with stat grid, deltas, event breakdowns, competition history, point history, and Recharts trends
- Explicit up/down trend arrows for OVR, points, and placement direction
- Quick-add point logging with the specified point formulas
- Officer approval queue
- AI tournament upload page with OpenAI extraction and local parser fallback
- Scio.ly-style Elo/SOS calculation hooks with national/equivalent benchmark comparison
- Admin drag-and-drop roster editor
- Team comparison page
- Audit log page
- API routes for point logs, approvals, tournament import, CSV export, and weekly snapshots
- Supabase schema with RLS, triggers, OVR recalculation, rate limiting, snapshots, and team OVR updates

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

The app runs in demo mode without environment variables. Add real credentials in `.env.local` when you are ready to persist to Supabase and use OpenAI extraction.

## GitHub Pages

This repo can be hosted as a static GitHub Pages site.

```bash
npm run build:pages
```

The static site is generated in `out/`. The included workflow at `.github/workflows/pages.yml` deploys that folder automatically when you push to `main`.

For a normal project Pages URL like `https://USER.github.io/REPO/`, the workflow infers the correct base path from the repo name. If you use a custom domain or a `USER.github.io` repo, set `NEXT_PUBLIC_BASE_PATH` to an empty string in the workflow or repository variables.

GitHub Pages cannot execute server routes, so hosted point approvals, point submission, and tournament import run as static demo interactions. Deploy to Vercel or another Node-capable host with Supabase credentials when you need persistent writes, OpenAI extraction, cron snapshots, or auth-backed role enforcement.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_SCHOOL_NAME="Obra D Tompkins High School"
SCIOLY_ELO_ENDPOINT=
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable email/password auth and email verification.
4. In Supabase Auth URL settings, add your deployed Vercel URL and local dev URL:
   - `http://localhost:3000`
   - `https://YOUR-VERCEL-PROJECT.vercel.app`
5. Add redirect URLs for auth callbacks:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-VERCEL-PROJECT.vercel.app/auth/callback`
6. Add the Supabase variables to `.env.local`.
7. Deploy to Vercel and add the same environment variables there.

## Accounts And Roles

- `/signup` creates a Supabase Auth user.
- New users are inserted into `students` automatically by the `handle_new_auth_user` database trigger.
- New accounts default to `viewer`, `60` OVR, and `0` points.
- `/login` signs users in with email/password.
- `/reset-password` sends reset emails and lets signed-in recovery sessions set a new password.
- The app falls back to demo mode only when Supabase env vars are missing.

To promote a user, update the `students.role` column in Supabase to `officer` or `admin`.

## Production Notes

- New users should be inserted into `students` after email verification, defaulting to `viewer`.
- The snapshot endpoint is `POST /api/cron/snapshots` with `Authorization: Bearer <CRON_SECRET>`.
- Tournament imports preview safely in demo mode. With Supabase credentials, commit writes tournaments, events, new students, and performances.
- `SCIOLY_ELO_ENDPOINT` is optional. Without it, the app uses a local fallback Elo map and defaults unknown schools to 1000.

## Rating Formula

Placement score now uses benchmark-relative competition difficulty:

```text
Placement Score = (100 - rank) x SOS x Benchmark Relative Difficulty
```

If a known national benchmark school is in the tournament field, the tournament is compared directly against that school. If not, the importer keeps comparing the field Elo against equivalent benchmark schools until it finds the closest benchmark tier. Placement deltas are inverted: rank going down is green because it means better placement, while rank going up is red.
