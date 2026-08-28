# Conference Coverage Board

A web app for Internal Medicine residents to request conference leave and for the
three chiefs to approve requests, arrange coverage, and track absences — built on
**Next.js + Supabase + Vercel**. It ships pre-loaded with the UF Health Jacksonville
AY 2026–2027 roster and block schedule.

**What it does**
- Residents open a link and submit a request (searchable name, click-to-select dates,
  auto-detected rotation from the schedule, presentation dates, UFGO/Lorna-Matos reminder).
- Chiefs sign in to a console: a review board (approve/deny + coverage), a color-coded
  calendar, per-conference summaries, per-resident tallies, and an admin panel.
- Approving a request suggests who's free to pull for coverage (non-core & not away).
- New requests email the chiefs' inbox; anything pending >7 days triggers a daily reminder.
- An admin panel lets next year's chiefs edit the roster and load a new schedule.

---

## Setup (about 30–40 min, no coding)

You'll create three free accounts — **Supabase** (database + logins), **Vercel** (hosting),
and optionally **Resend** (email) — then paste a few keys. Follow in order.

### 1) Create the database (Supabase)
1. Go to **supabase.com** → sign up → **New project**. Pick a name, a strong database
   password (save it), and a region near you. Wait ~2 minutes for it to provision.
2. In the project, open **SQL Editor** → **New query**. Open `supabase/schema.sql` from
   this project, paste the whole thing, and click **Run**. (Creates the tables.)
3. New query again. Paste all of `supabase/seed.sql` and **Run**. (Loads the 54 residents
   and the block schedule.)
4. Open **Settings → API** and copy these three values — you'll need them in step 3:
   - **Project URL**  → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click reveal) → `SUPABASE_SERVICE_ROLE_KEY`  ⚠️ secret — never share.

### 2) Put the code on GitHub
Vercel deploys from a GitHub repo.
1. Go to **github.com** → **New repository** → name it (e.g. `conference-coverage-board`),
   keep it **Private**, click **Create**.
2. On the new repo page, click **uploading an existing file**, then drag in **all the
   files and folders** from this project (everything except `node_modules`, `.next`, and
   `.env.local` — those aren't included in the zip anyway). Commit.
   *(Prefer the terminal? `git init && git add . && git commit -m "init" && git remote add
   origin <your-repo-url> && git push -u origin main`.)*

### 3) Deploy to Vercel
1. Go to **vercel.com** → sign up **with GitHub** → **Add New… → Project** → import the repo.
2. Before clicking Deploy, expand **Environment Variables** and add each of these
   (names exactly as shown). Use `.env.example` as your checklist:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1.4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1.4 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1.4 (secret) |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now — you'll set it after the first deploy |
   | `CHIEF_EMAILS` | the 3 chiefs' emails, comma-separated |
   | `CHIEFS_INBOX` | `IMChiefs.UFJPI@ufhealth.org` |
   | `EMAIL_FROM` | `Coverage Board <onboarding@resend.dev>` (change after Resend setup) |
   | `RESEND_API_KEY` | leave blank for now (email optional) |
   | `CRON_SECRET` | a long random string (mash the keyboard) |
3. Click **Deploy**. When it finishes, Vercel gives you a URL like
   `https://conference-coverage-board.vercel.app`.
4. Copy that URL. In Vercel **Settings → Environment Variables**, set
   `NEXT_PUBLIC_SITE_URL` to it, then **Redeploy** (Deployments → ⋯ → Redeploy).

### 3b) Prefer Netlify? (instead of Vercel)
This project deploys on **Netlify** too — a `netlify.toml` and a scheduled function are included.
1. **netlify.com** → **Add new site → Import an existing project** → pick your GitHub repo.
2. Netlify auto-detects Next.js (installs the Next runtime). Build command `npm run build` is set by
   `netlify.toml`. Add the **same environment variables** as the Vercel table above (Site settings →
   Environment variables). Set `NEXT_PUBLIC_SITE_URL` to your Netlify URL after the first deploy, then
   redeploy.
3. The daily reminder runs as a **Netlify Scheduled Function** (`netlify/functions/reminders.mts`) —
   nothing to configure; Netlify picks up its schedule automatically. (The `vercel.json` cron is simply
   ignored on Netlify.)
4. Use your Netlify URL everywhere step 4 mentions the site URL / `/auth/callback` redirect.

### 4) Turn on chief logins (Supabase Auth)
1. In Supabase → **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL.
   - **Redirect URLs**: add `https://YOUR-URL/auth/callback`.
2. That's it — chiefs sign in by entering their email and clicking the magic link.
   Only the addresses in `CHIEF_EMAILS` can reach the console; everyone else is blocked
   even if they get a link.

### 5) Email (optional but recommended)
Without this, the app works fully — it just won't send emails.
1. Sign up at **resend.com**. To email the real `IMChiefs` inbox you must **verify a
   domain** you control (Resend → Domains). For a quick test first, `onboarding@resend.dev`
   can only email the address you signed up with.
2. Copy your **API key** → set `RESEND_API_KEY` in Vercel. Once your domain is verified,
   set `EMAIL_FROM` to something like `Coverage Board <coverage@yourdomain.org>`. Redeploy.

### 6) Reminders (already set up)
`vercel.json` schedules the 7-day reminder sweep daily at ~9am ET. Vercel runs it
automatically and authenticates it with your `CRON_SECRET` — nothing else to do.

---

## Using it
- **Residents:** share the site root (`https://YOUR-URL/`). That's the form — no login.
  Put this link on the residency SharePoint page.
- **Chiefs:** go to `https://YOUR-URL/login`, enter your email, click the link. You land
  on the console.
- **Next year:** in the console → **Admin**, edit the roster and paste the new year's
  block-grid CSV to replace the schedule. New residents load as "Last, Initial" — rename
  them in the roster table.

## Notes on the seeded data
- The schedule's blank duplicate "Watford, S" (PGY-1) row was dropped — there's only one
  Watford (Shelby, PGY-3). "Dyer, N" is Noah Dyer, who goes by Connor, shown as "Connor Dyer".
- To change the block **dates** for a new year, edit the `blocks` table in Supabase (SQL
  Editor) or extend the admin schedule upload to include them.

## Run locally (optional)
```
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev                  # http://localhost:3000
```

## Tech
Next.js 14 (App Router) · Supabase (Postgres + Auth, RLS-locked) · Resend · Vercel Cron.
All data access goes through server-side API routes using the service-role key; the browser
never touches the database directly.
