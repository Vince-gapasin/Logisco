# Logisco

Dispatch and delivery tracking for a trucking operation. One web app serves
three kinds of staff, plus the customer:

| Who | Where | What they do |
|---|---|---|
| Admin, Coordinator | `/admindashboard` | Bookings, calendar, dispatch, clients, employees, fleet, foul trips, forecasting, reports, system health |
| Driver, Helper | `/crew` | Accept assigned trips, check in at stops, report issues, upload proof of delivery |
| Mechanic | `/mechanic` | Fleet status, maintenance history, roadside assistance |
| Customer | `/client-view?token=…` | Public tracking page sent by email, and delivery feedback |

The Android app (`android/`, Capacitor) is a shell around the deployed site. It
adds background location and push notifications; it does not bundle the web app.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4. **This Next.js has breaking
  changes from older versions** - read `node_modules/next/dist/docs/` before
  writing Next-specific code (see `AGENTS.md`).
- Supabase: Postgres, auth, storage for delivery proofs, and `pg_cron` for the
  stalled-truck check.
- Mapbox for maps, geocoding and routing; Recharts; jsPDF for reports;
  nodemailer for email; Zod for request validation.
- Vitest for tests.

## Layout

```
app/
  admindashboard/ crew/ mechanic/   screens, one folder per portal
  api/                              route handlers - thin: authorize, validate, call a service
  lib/                              shared rules and helpers (stall rules, feasibility, auth...)
  schemas/                          Zod schemas for request bodies
components/                         shared UI, grouped by area
services/                           business logic and database access, grouped by area
types/                              shared types; types/database.ts is generated
supabase/migrations/                schema changes, applied in filename order
scripts/                            one-off backfills and diagnostics (see each file's header)
tests/                              Vitest; tests/support/supabaseDouble.ts fakes the client
```

### How requests are authorized

The browser only uses Supabase to sign in. Everything else goes through
`/api/*`, and every route starts with `authorize(request, roles)` from
`app/lib/auth.ts`, which verifies the bearer token, loads the caller's
`Employee` row, rejects inactive accounts and checks the role. Route handlers
then use the service-role client in `app/lib/supabase.ts`, which bypasses Row
Level Security - so a route that skips `authorize` is open to anyone.

The exceptions are deliberate: sign-in, forgot-password, the email-change
confirmation link, the public tracking endpoints (`/api/track/[token]`, keyed by
a random UUID), and scheduled jobs, which check `CRON_SECRET`.

## Getting started

Needs Node 20.9 or newer (CI uses 24).

```bash
npm install
npm run dev
```

Create `.env` with at least the Supabase settings:

| Variable | Needed for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Server-side database access (required) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sign-in from the browser (required) |
| `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_TOKEN` | Maps in the browser; geocoding and routing on the server |
| `APP_URL` | Links in activation and tracking emails (must be the public address in production) |
| `NEXT_PUBLIC_SITE_URL` | Email-change confirmation links (falls back to the request host) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Sending email |
| `CRON_SECRET` | Authorizing scheduled jobs (Vercel cron, GitHub Actions, `pg_cron`) |
| `FIREBASE_SERVICE_ACCOUNT` | Sending push notifications (JSON of a Firebase service account) |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_LOCATION_CODE` | Weather sync for forecasting (defaults to Manila) |

Admin → System health checks most of these against the running deployment.

## Scripts

```bash
npm run dev         # development server
npm run dev:clean   # development server, after deleting its cache (see below)
npm run build       # production build
npm test            # Vitest, once
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

The development server keeps a cache in `.next/dev` between runs. Now and then
it goes stale: a style you added does not appear, or an API route that exists
answers 404, and restarting with `npm run dev` brings the same stale state back.
Stop the server and start it with `npm run dev:clean` instead. The first start
after that is slower while the cache is rebuilt. Production builds are not
affected.

Regenerate `types/database.ts` after a schema change:

```bash
npx tsx --env-file=.env scripts/generateDatabaseTypes.ts
```

## Database changes

Add a file to `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql` and
apply it with the Supabase CLI (`supabase db push`) or the SQL editor. Then
regenerate the types as above.

## Deployment and automation

- **Web:** Vercel, at https://logisco.company. `vercel.json` schedules the
  monthly forecasting job and the twice-weekly fuel price sync.
- **Stalled-truck check:** `pg_cron`, every minute, from inside the database
  (`supabase/migrations/20260929000000_stall_check_schedule.sql`).
- **CI** (`.github/workflows/ci.yml`): typecheck, tests, build and lint on every
  push to `main` and `monorepo-copy` and on pull requests. Any lint error fails it.
- **Android APK** (`.github/workflows/android.yml`): built when the native
  project or Capacitor config changes, or on demand. It needs these repository
  secrets:
  - `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
    `ANDROID_KEY_PASSWORD` - the release signing key, so builds install over
    each other.
  - `GOOGLE_SERVICES_JSON` - the contents of `google-services.json` from the
    Firebase console. Without it the APK builds but gets no push notifications.

### Android locally

`android/app/google-services.json` is not in the repository. Download it from
the Firebase console (project settings → your Android app) and put it there.

```bash
npx cap sync android
```

Then open `android/` in Android Studio. To point a build at a local dev server,
set `CAPACITOR_SERVER_URL` to your machine's LAN address (not `localhost` - on a
phone that is the phone).
