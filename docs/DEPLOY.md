# Deploy

## Supabase (done — live)

- Project: **kalibra** (`mvrbfiztubrbbepwgnnm`, region ap-southeast-1).
- URL: `https://mvrbfiztubrbbepwgnnm.supabase.co`
- Schema applied (`markets`, `predictions`, `resolutions`, `market_overview` view).
- **RLS enabled** with public read-only policies; writes are service-role only (forecasts are
  public by design, but nobody can tamper via the anon key).
- Seeded with the real Amoy run (8 markets, 6 committed, 2 resolved) so the dashboard shows live,
  on-chain-backed data with working PolygonScan links.

The publishable (anon) key is non-secret and safe to embed; the dashboard uses it for read-only
access. The **service-role** key (never committed) is only needed if you want the agent to write to
Supabase directly — see below.

## Vercel (one-time git import → auto-deploy)

The repo is pre-configured (`vercel.json` builds the `apps/web` workspace; the dashboard defaults to
the public Supabase project in production, so **no env vars are required**).

1. Go to <https://vercel.com/new> and **Import** `ENDUGI1/Kalibra`.
2. Set **Root Directory** to `apps/web` (recommended — Vercel auto-detects Next.js and installs the
   pnpm workspace from the repo root). Leave the rest as detected.
3. Click **Deploy**. Done — you get a live URL, and every push to `main` redeploys automatically.

No environment variables are needed for the dashboard. To point it at a *different* Supabase
project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Vercel project settings.

## (Optional) Agent → Supabase live writes

The dashboard currently reads a seeded snapshot of the real Amoy run. To have the agent persist
*future* runs to Supabase instead of the local state file:

1. Get the **service-role** key from the Supabase dashboard (Project → Settings → API). Keep it
   secret — `.env` only, never commit.
2. In `apps/agent/.env`: `STORE_MODE=supabase`, `SUPABASE_URL=…`, `SUPABASE_SERVICE_KEY=…`.
3. `pnpm agent:run` upserts markets + predictions. (Resolution upserts to Supabase are a follow-up;
   today `resolveOnce` writes resolutions to the local state file.)
