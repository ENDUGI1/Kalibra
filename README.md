# Kalibra

[![CI](https://github.com/ENDUGI1/Kalibra/actions/workflows/ci.yml/badge.svg)](https://github.com/ENDUGI1/Kalibra/actions/workflows/ci.yml)

**An on-chain forecasting agent.** Kalibra does **not** place bets. It produces probabilistic
forecasts for football prediction markets, measures the *edge* between its own model and the market
price, and — when the edge is large enough — **commits a hashed prediction on-chain before kickoff**
(anti-backdating). After a match resolves, the prediction is revealed, scored with a
[Brier score](https://en.wikipedia.org/wiki/Brier_score), and the agent's calibration reputation is
updated on-chain.

The product is a **market-efficiency & calibration research terminal** — verified, accountable
forecasting. It is *not* a betting tool, and it never executes trades.

```
fetch market odds  →  model forecast  →  compute edge  →  commit hash on-chain  →  (later) reveal + Brier + reputation
```

## Monorepo layout

| Path                | Stack                     | Responsibility                                                        |
| ------------------- | ------------------------- | -------------------------------------------------------------------- |
| `contracts/`        | Solidity + Foundry        | `PredictionRegistry` — commit/reveal + reputation (Polygon Amoy)     |
| `model/`            | Python + FastAPI          | `POST /predict` — baseline Poisson forecast (`prob_home`)            |
| `apps/agent/`       | TypeScript (Node)         | `runOnce()` commit pipeline + `resolveOnce()` reveal/score pipeline  |
| `apps/web/`         | Next.js 14 + Tailwind v4  | Forecasting / calibration dashboard (dark, data-dense)               |
| `packages/shared/`  | TypeScript                | Types shared across `agent` and `web`                                |
| `supabase/`         | SQL migrations            | `markets`, `predictions`, `resolutions` schema                       |

## Prerequisites

- **Node** ≥ 20 and **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Python** ≥ 3.11 (for the model service)
- **Foundry** (`forge`, `cast`, `anvil`) — https://book.getfoundry.sh/getting-started/installation

## Quickstart

```bash
pnpm install            # install all workspace dependencies

# 1. Contracts
cd contracts && forge test          # commit→reveal→record + revert tests

# 2. Model service (separate terminal)
cd model && uv sync && uv run uvicorn app.main:app --reload   # http://127.0.0.1:8000

# 3. Agent pipeline (one-shot)
cp apps/agent/.env.example apps/agent/.env   # then fill values; CHAIN_MODE=mock works with no key
pnpm agent:run          # fetch → predict → edge → commit
pnpm agent:resolve      # reveal → Brier → recordOutcome (after outcomes are known)

# 4. Dashboard
pnpm dev:web            # http://localhost:3000
```

## Deployment

The dashboard reads from a **live Supabase** project (Postgres, RLS-protected, seeded with the real
Amoy run) and deploys to **Vercel** via git integration. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Phase 0 scope

A single dummy market flows **fetch → predict → edge → commit (mock or Amoy) → dashboard**. That
vertical slice is the deliverable. Out of scope until Phase 1+: heavy ML models, Vercel Cron,
automated reveal/scoring, multi-league coverage. See [`docs/PHASE-0.md`](docs/PHASE-0.md) for the
status report and the Phase 1 checklist (generated at the end of Phase 0).

## Security

- Real secrets live in `.env` files which are git-ignored. Only `.env.example` is committed.
- Never paste a funded private key into a shared channel. For dev, use a throwaway key funded from
  the [Amoy faucet](https://faucet.polygon.technology/).
