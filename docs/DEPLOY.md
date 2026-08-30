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

`apps/web/vercel.json` pins the build config (framework, install/build command, and
`outputDirectory: .next` relative to the root directory). The dashboard defaults to the public
Supabase project in production, so **no env vars are required**.

1. Go to <https://vercel.com/new> and **Import** `ENDUGI1/Kalibra`.
2. **Set Root Directory to `apps/web`.** Vercel reads `apps/web/vercel.json`, auto-detects Next.js,
   and installs the pnpm workspace from the repo root.
3. Click **Deploy**. Done — you get a live URL, and every push to `main` redeploys automatically.

> **Build fails with a doubled path** (`/vercel/path0/apps/web/apps/web/.next`)? That means the
> project's **Output Directory** setting is still overridden to `apps/web/.next` (left over from an
> earlier import). `apps/web/vercel.json` now overrides it to the correct `.next`, so just
> **Redeploy**. If it still fails, go to **Settings → Build and Deployment** and **clear the Output
> Directory override** (leave it on the Next.js default).

No environment variables are needed. To point at a *different* Supabase project, set `SUPABASE_URL`
and `SUPABASE_ANON_KEY` in the Vercel project settings.

## Scheduled agent (GitHub Actions)

`.github/workflows/agent.yml` runs the pipeline: real ESPN markets → forecast → commit on Amoy →
resolve finished matches → write to Supabase. The model service is started on the runner itself (no
hosting needed). The workflow **skips (stays green)** until the secrets are set.

> **Cron is currently disabled** (manual trigger only, via Actions → "Agent (scheduled)" → Run
> workflow) — this avoids unwanted scheduled runs/emails while the project is paused. To resume
> automatic runs, add back a `schedule:` trigger (e.g. `cron: "0 */12 * * *"` for every 12 hours) in
> the workflow's `on:` block.

Add these under **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| ------ | ----- |
| `PRIVATE_KEY` | The **contract owner** key (the address that deployed `PredictionRegistry`). Only the owner can commit/reveal/record — a different key reverts with `NotOwner`. On Amoy this is a testnet throwaway; for mainnet, use a fresh key and redeploy. |
| `CONTRACT_ADDRESS` | `0x94DC253fa37d416573760f10BD6188fE0234CC34` |
| `SUPABASE_URL` | `https://mvrbfiztubrbbepwgnnm.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service-role key (Supabase → Settings → API) |
| `RPC_URL` | *(optional)* defaults to the public Amoy RPC |

Cost: GitHub Actions is free for public repos; Amoy uses faucet test-POL. Scheduled workflows on
public repos auto-pause after ~60 days of repo inactivity (re-enable in the Actions tab).

## Security: public reads are view-only

RLS is enabled and **anon can only read the `market_overview` view** (no `salt` column). Direct
reads of the `markets` / `predictions` / `resolutions` tables are revoked for `anon`, so the secret
`salt` is never exposed before reveal (the probability space is tiny, so a leaked salt would make the
commitment guessable). Writes and salt reads require the **service-role** key.

## (Optional) Agent → Supabase live writes

The dashboard currently reads a seeded snapshot of the real Amoy run. To have the agent persist
*future* runs to Supabase, end to end (commit **and** resolution):

1. Get the **service-role** key from the Supabase dashboard (Project → Settings → API). Keep it
   secret — `.env` only, never commit.
2. In `apps/agent/.env`: `STORE_MODE=supabase`, `SUPABASE_URL=…`, `SUPABASE_SERVICE_KEY=<service-role>`.
3. `pnpm agent:run` upserts markets + predictions; `pnpm agent:resolve` upserts resolutions and flips
   prediction status to `revealed`. The salt ledger always stays in the local state file (never
   round-tripped through the public API).

> Heads-up: a real run upserts by `market_id`, so it will **overwrite the seeded demo rows** with your
> run's data (e.g. mock tx hashes if `CHAIN_MODE=mock`). Use `CHAIN_MODE=amoy` for runs you want
> backed by real on-chain txs.
