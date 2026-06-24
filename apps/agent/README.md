# agent — Kalibra pipeline

A single `runOnce()` that executes the Phase 0 vertical slice:

```
fetch markets → model predict → compute edge → commit hash (mock|amoy) → persist snapshot
```

Manual trigger only (no scheduler in Phase 0). One bad market is logged and skipped without
aborting the run.

## Run

```bash
cp .env.example .env          # defaults work with no secrets
pnpm --filter @kalibra/agent run:once
# or from the repo root: pnpm agent:run
```

For the real model forecast, start the model service first (`cd model && uvicorn app.main:app`).
If it's unreachable the agent logs a warning and uses a local fallback forecast, so the slice still
completes.

## Modes (env)

| Var                | Default   | Other     | Effect                                                       |
| ------------------ | --------- | --------- | ------------------------------------------------------------ |
| `CHAIN_MODE`       | `mock`    | `amoy`    | Simulate the commit tx vs. send a real one to the contract.  |
| `MODEL_MODE`       | `service` | `fallback`| Call FastAPI vs. local heuristic.                            |
| `POLYMARKET_MODE`  | `fixture` | `live`    | Local fixtures vs. read-only Gamma API (best-effort).        |
| `STORE_MODE`       | `mock`    | `supabase`| Local state file vs. Supabase upsert.                        |
| `EDGE_THRESHOLD_BPS` | `500`   |           | Commit only when `|edge| >= threshold` (bps).               |

## Going on-chain (Amoy)

1. Deploy the contract (see `contracts/README.md`) and copy its address.
2. In `.env`: set `CHAIN_MODE=amoy`, `RPC_URL`, `PRIVATE_KEY` (funded dev key), `CONTRACT_ADDRESS`.
3. `pnpm agent:run` — the agent submits `commitPrediction` and waits for the receipt.

## Output

Writes `.data/state.json` at the repo root (override with `KALIBRA_STATE_FILE`). The dashboard's
mock data layer reads this file; with `STORE_MODE=supabase` the same data is upserted to Postgres.
