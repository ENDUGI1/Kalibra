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

## Phase 1 checklist

- [ ] Deploy `PredictionRegistry` to Amoy; run the agent with `CHAIN_MODE=amoy` and land a real commit.
- [ ] Stand up a Supabase project; apply the migration; switch `STORE_MODE=supabase`. Regenerate
      `database.types.ts` from the live schema.
- [ ] Harden the live Polymarket Gamma adapter (reliable home-win price extraction, 1X2 handling,
      pagination, rate limits).
- [ ] Resolution loop: after kickoff, `revealPrediction` then `recordOutcome` with the computed
      Brier score; surface reputation on the dashboard.
- [ ] Real reliability diagram: bin revealed forecasts by predicted probability, plot observed
      frequency vs. forecast, add count-weighted points.
- [ ] Replace the Poisson baseline with a fitted model (team ratings / xG features) behind the same
      `/predict` contract.
- [ ] Scheduling: move `runOnce()` to a Vercel Cron / scheduled job; add idempotency + alerting.
- [ ] Access control & ops: dedicated agent key management, gas handling, retries, structured
      monitoring.
- [ ] CI: `forge test`, `pytest`, `tsc`, `next build` on every push.
