# SciOly Tracker

Full-stack Science Olympiad team analytics for Obra D Tompkins High School. The app tracks competition results, testoffs, practice points, player and event rankings, A/B/C rosters, approvals, and an admin audit trail.

## Stack

- Next.js 15 and TypeScript
- Vercel Functions and weekly Vercel Cron snapshots
- Supabase Postgres, Auth, and Row Level Security
- Tailwind CSS and Recharts

GitHub Pages is no longer the production target because a static deployment cannot run authentication, API routes, imports, or database writes.

## Local development

```bash
npm ci
npm run dev
```

Development runs with demo data when Supabase variables are absent. Production fails closed unless Supabase is configured or `ENABLE_DEMO_MODE=true` is deliberately set.

## 1. Create the Supabase backend

1. Create a Supabase project, either directly or from **Vercel → Project → Storage → Create Database → Supabase**.
2. Open the Supabase SQL editor.
3. Run the complete [`supabase/schema.sql`](supabase/schema.sql) file once.
   Re-run the complete, idempotent schema after pulling schema-changing updates; the account-deletion flow requires the latest functions and columns.
4. In Supabase Auth URL settings, set:
   - Site URL: your canonical production URL (currently `https://www.sciolytracker.com`)
   - Redirect URLs: `https://www.sciolytracker.com/auth/callback` and `https://sciolytracker.com/auth/callback`
   - Also add `https://YOUR-PROJECT.vercel.app/auth/callback` and any Vercel preview callback URL you use while setting up.
5. Enable email confirmation.
6. To enable **Continue with Google**:
   - In Google Auth Platform, create a **Web application** OAuth client. Add the production site under **Authorized JavaScript origins**.
   - Add the Supabase callback shown on the Supabase Google provider page under **Authorized redirect URIs**. For this project it is `https://odyrltsjihzkqewmnzdp.supabase.co/auth/v1/callback`.
   - In **Supabase → Authentication → Sign In / Providers → Google**, enter that client's ID and secret, enable the provider, and save.

The Google client secret belongs in Supabase, not in this repository or Vercel's public environment variables.

The schema bootstraps `aaravsinha002@gmail.com` as an admin. If the admin email changes, update both Vercel's `DEFAULT_ADMIN_EMAILS` variable and the Supabase setting:

```sql
update public.system_settings
set value = '["new-admin@example.com"]'::jsonb
where key = 'default_admin_emails';
```

For the first deployment, temporarily set `ALLOW_PUBLIC_SIGNUP=true`, create the administrator account at the initial Vercel URL, then immediately set it back to `false` and redeploy. Before attaching the public domain, also disable new-user signup in Supabase Auth. Add future team members from the Supabase Auth dashboard so existing users can still sign in while outsiders cannot create accounts.

## 2. Deploy from GitHub to Vercel

1. In Vercel, choose **Add New → Project**.
2. Import `aaravsinhaofficial/scioly-2k-analytics-dashboard`.
3. Keep these project settings:
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: leave blank
   - Node.js: `22.x`
4. Do **not** set `NEXT_OUTPUT` or `NEXT_PUBLIC_BASE_PATH`; those were only for GitHub Pages.
5. Add the environment variables below to Production and Preview, then deploy. Set `APP_URL` only in Production; leave it unset in Preview so each preview deployment uses its own callback origin.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; keep secret |
| `APP_URL` | Production only: the canonical production origin; omit in Preview |
| `DEFAULT_ADMIN_EMAILS` | `aaravsinha002@gmail.com` |
| `ALLOW_PUBLIC_SIGNUP` | `false` after the first administrator account is created |
| `CRON_SECRET` | A random 64-character secret |
| `NEXT_PUBLIC_SCHOOL_NAME` | `Obra D Tompkins High School` |
| `TRACKED_SCHOOL_ALIASES` | `Tompkins High School,Tompkins HS` |
| `ENABLE_DEMO_MODE` | `false` |
| `SCIOLY_ELO_ENDPOINT` | Optional external Elo endpoint; omit initially |

Generate the cron secret locally with:

```bash
openssl rand -hex 32
```

The committed `vercel.json` schedules weekly OVR snapshots. Vercel automatically supplies `CRON_SECRET` to the scheduled request.

## 3. Connect sciolytracker.com from GoDaddy

First add both `sciolytracker.com` and `www.sciolytracker.com` under **Vercel Project → Settings → Domains**. Then replace the GoDaddy Website Builder records with:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `@` | `76.76.21.21` | 1 hour |
| `CNAME` | `www` | `cname.vercel-dns-0.com` | 1 hour |

If Vercel displays a project-specific `*.vercel-dns-*.com` CNAME, use the exact value Vercel displays instead. Remove the existing `A @ → WebsiteBuilder Site` record and any old `www` Website Builder CNAME. Do not remove GoDaddy nameservers, MX records, or unrelated TXT records. Add a Vercel TXT verification record only if the Vercel Domains screen asks for it.

Set `www.sciolytracker.com` as the primary production domain and redirect `sciolytracker.com` to it. Vercel provisions HTTPS automatically after DNS validates.

## Operational workflow

- Students submit practice logs; officers approve or reject them.
- Officers import Tompkins tournament results from CSV, enter testoff sessions and scores, and bulk-import practice-test questions from public Google Sheets or parsed CSV files.
- Members can add event-library resources; officers and admins retain moderation and removal controls.
- Members can delete their own login and personal profile. Historical competition and team records remain attached to an anonymized placeholder.
- Testoff rankings normalize raw score by the session maximum and weight.
- Admins manage accounts, roles, A/B/C rosters, custom point categories, and audit reversals.
- Competition imports retain the full field for strength-of-schedule calculations but credit only schools matching the configured Tompkins aliases.
