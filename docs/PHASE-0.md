# Phase 0 — Status Report

The Phase 0 vertical slice is complete: a single dummy market flows
**fetch → predict → edge → commit → dashboard**.

## Live on Polygon Amoy (testnet)

The slice has run end-to-end on-chain, not just in mock mode.

- **`PredictionRegistry`**: [`0x94DC253fa37d416573760f10BD6188fE0234CC34`](https://amoy.polygonscan.com/address/0x94DC253fa37d416573760f10BD6188fE0234CC34)
- **Agent / owner**: `0xce801AB6A2C20f6D6A712049A0c4dA3f667D27A6`
- **Real `commitPrediction` txs** (4 actionable markets, each receipt confirmed):

| Market | Tx |
| ------ | -- |
| MCI v LIV | [`0x3a949c78…fe8898`](https://amoy.polygonscan.com/tx/0x3a949c7848c06332652ef0e7edff37b83f0b651543a4ba39abd5a64946fe8898) |
| RMA v FCB | [`0x045e1484…5a2aa`](https://amoy.polygonscan.com/tx/0x045e1484f176ab40bef8fc4f5457ff8776d97726d5e54c7973ff87339fe5a2aa) |
| INT v JUV | [`0x078d90e1…e4f17`](https://amoy.polygonscan.com/tx/0x078d90e16ffc35b3333cde95d8eb2e192119fa6a379973a850078635fb9e4f17) |
| BAY v DOR | [`0xab17aaa8…d1e1c`](https://amoy.polygonscan.com/tx/0xab17aaa8da4b8d6904aa214781936b02fd538be43ef2dcde6291014c567d1e1c) |

Verified on-chain: first commit receipt `status=1 (success)`; `getPrediction` for a committed market
returns `status=Committed`, `probBps=0` (unrevealed, as expected); `getReputation()` = `(0, 0)`
(no resolutions yet). The wallet is a disposable testnet key — never funded with real assets.

## What works (verified)

| Step | Component | Evidence |
| ---- | --------- | -------- |
| Scaffold | pnpm monorepo (`packages/*`, `apps/*`) | `pnpm install` succeeds across 3 workspace projects |
| Contracts | `PredictionRegistry` commit-reveal + reputation | `forge test` → **11/11 passing** (happy path + hash-mismatch revert + guards) |
| Model | FastAPI `/health` + `/predict`, Poisson baseline | `pytest` → **5/5 passing**; live `/health` returns `baseline-0.1` |
| Shared | Cross-package types, bps math, DB types | `tsc --noEmit` clean |
| Agent | `runOnce()` pipeline | `pnpm agent:run` → evaluated 5, committed 4, skipped 1, snapshot written, exit 0 |
| Web | Dark forecasting/calibration dashboard | `next build` clean; renders pipeline output |

End-to-end run output (mock chain):

```
fetch    loaded 5 fixture markets
edge     ARS vs CHE  edgeBps=267   actionable=false  → skipped (below 5.00% threshold)
edge     MCI vs LIV  edgeBps=-2329 actionable=true   → committed
edge     RMA vs FCB  edgeBps=-2168 actionable=true   → committed
edge     INT vs JUV  edgeBps=-2927 actionable=true   → committed
edge     BAY vs DOR  edgeBps=823   actionable=true   → committed
pipeline runOnce complete  evaluated=5 committed=4 skipped=1
```

## What is mocked / deferred in Phase 0

| Area | Phase 0 state | Real path (already wired, needs config) |
| ---- | ------------- | --------------------------------------- |
| **Chain commit** | `CHAIN_MODE=mock` — deterministic simulated tx hash | `CHAIN_MODE=amoy` + deployed contract + funded key → real `commitPrediction` via viem. See [AMOY-SETUP.md](AMOY-SETUP.md) |
| **Market source** | `POLYMARKET_MODE=fixture` — `apps/agent/fixtures/markets.json` | `POLYMARKET_MODE=live` — read-only Gamma API adapter exists (best-effort mapping) |
| **Storage** | `STORE_MODE=mock` — `.data/state.json` read by the dashboard | `STORE_MODE=supabase` — PostgREST upsert wired; run `supabase/migrations/0001_init.sql` first |
| **Model** | Deterministic Poisson baseline | Same API contract; swap the model behind `/predict` |
| **Reveal + reputation** | Contract supports it; not driven by the agent yet | Phase 1 |
| **Reliability diagram** | Axes + reference line + empty state (no resolutions yet) | Plots binned points once outcomes are recorded |

## Why these choices

- **bps everywhere** (0..10000) — probabilities & Brier scores match the on-chain
  representation exactly, avoiding float drift between Solidity, Python, TS, and Postgres.
- **Mock adapters by default** — the whole slice runs with zero secrets, so the pipeline is
  reproducible and demoable offline; each adapter has a real path behind one env flag.
- **Single data layer** — the dashboard reads Supabase → state file → seed (in that order);
  no data is hardcoded in components.

## Phase 1 progress — resolution loop (done)

The commit→reveal→record loop now runs end-to-end, including on Amoy.

- `agent:resolve` (`resolveOnce()`): for each committed prediction with a known outcome →
  `revealPrediction` → compute Brier → `recordOutcome`, then refresh reputation (read on-chain in
  `amoy` mode).
- Salt ledger persisted between runs so reveals match their commits; `runOnce()` is idempotent on
  Amoy (skips markets already committed on-chain).
- Outcomes via `apps/agent/fixtures/outcomes.json` (real results feed plugs in behind the same
  adapter).
- Dashboard fills in: Avg Brier + Avg edge metrics, Result/Brier table columns, and a binned
  reliability diagram.

Verified on Amoy: `getReputation()` = `(2, 4211 bps)`; `getPrediction(TOT)` = `status=Resolved`,
`probBps=3913`, `brierBps=3705`. Real reveal/record txs:

| Market | Reveal | Record |
| ------ | ------ | ------ |
| TOT v NEW | [`0x62fced42…`](https://amoy.polygonscan.com/tx/0x62fced42ac51f8949e2c5abc05a721cd6ffba0ca2145b99def62108bbd64084e) | [`0xb375f65a…`](https://amoy.polygonscan.com/tx/0xb375f65acc1e06b21fbe16c43fc958567b2897850a67e06c24ceedaf3711c89b) |
| ATM v SEV | [`0xa362cb1c…`](https://amoy.polygonscan.com/tx/0xa362cb1c850622190ac67cf0e8fb9bf20b429e68985662e5ead04ed1c80eb9c3) | [`0x362890d7…`](https://amoy.polygonscan.com/tx/0x362890d7fde01cffb7370f3e48a710027e63ad232097989af9d6ada2d2b97836) |

## Phase 1 checklist

- [x] Deploy `PredictionRegistry` to Amoy; run the agent with `CHAIN_MODE=amoy` and land a real commit.
- [x] Resolution loop: reveal → Brier → record; surface reputation on the dashboard.
- [x] Reliability diagram plots binned observed-frequency points.
- [ ] Stand up a Supabase project; apply the migration; switch `STORE_MODE=supabase`. Regenerate
      `database.types.ts` from the live schema.
- [x] CI: `forge test`, `pytest`, `tsc`, `next build` on every push (GitHub Actions).
- [ ] Auto-trigger resolution: poll a real results feed after kickoff (replace `outcomes.json`).
- [ ] Stand up a Supabase project; apply the migration; switch `STORE_MODE=supabase`. Regenerate
      `database.types.ts` from the live schema.
- [ ] Harden the live Polymarket Gamma adapter (reliable home-win price extraction, 1X2 handling,
      pagination, rate limits).
- [ ] Replace the Poisson baseline with a fitted model (team ratings / xG features) behind the same
      `/predict` contract.
- [ ] Scheduling: move `runOnce()` / `resolveOnce()` to a Vercel Cron / scheduled job; add alerting.
- [ ] Access control & ops: dedicated agent key management, gas handling, retries, structured
      monitoring.
