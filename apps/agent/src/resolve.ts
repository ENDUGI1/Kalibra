import { type Hex } from "viem";
import { brierBps as computeBrierBps } from "@kalibra/shared";
import { recordOutcome, revealPrediction } from "./adapters/chain.js";
import { fetchOutcomes } from "./adapters/outcomes.js";
import { computeReputation, loadSnapshot, persistResolutions } from "./adapters/store.js";
import { type Config, loadConfig } from "./config.js";
import { log } from "./lib/logger.js";

export interface ResolveSummary {
  revealed: number;
  recorded: number;
  pending: number;
}

/**
 * Resolve committed predictions whose outcomes are now known:
 * reveal → compute Brier → recordOutcome, then refresh reputation.
 * Manual trigger (Phase 1), mirrors runOnce. Per-market failures are isolated.
 */
export async function resolveOnce(cfg: Config = loadConfig()): Promise<ResolveSummary> {
  log.info("resolve", "resolveOnce starting", { chainMode: cfg.chainMode });

  const snapshot = await loadSnapshot();
  if (!snapshot?.predictions?.length) {
    log.warn("resolve", "no prediction ledger found — run the pipeline (agent:run) first");
    return { revealed: 0, recorded: 0, pending: 0 };
  }

  const outcomes = await fetchOutcomes(cfg);
  const resolutions = snapshot.resolutions ?? [];
  const already = new Set(resolutions.map((r) => r.marketId));

  let revealed = 0;
  let recorded = 0;
  let pending = 0;

  for (const pred of snapshot.predictions) {
    if (pred.status !== "committed" || already.has(pred.marketId)) continue;

    const outcome = outcomes.get(pred.marketId);
    if (outcome === undefined) {
      pending += 1;
      continue; // match not settled yet
    }

    try {
      const marketId = pred.marketId as Hex;
      const revealTx = await revealPrediction(cfg, marketId, pred.probBps, pred.salt as Hex);
      revealed += 1;

      const brierBps = computeBrierBps(pred.probBps, outcome);
      const recordTx = await recordOutcome(cfg, marketId, outcome, brierBps);
      recorded += 1;

      pred.status = "revealed";
      resolutions.push({
        marketId: pred.marketId,
        outcome,
        brierBps,
        recordTx: recordTx.txHash,
        resolvedAt: new Date().toISOString(),
      });

      const row = snapshot.overview.find((o) => o.marketId === pred.marketId);
      if (row) {
        row.commitStatus = "revealed";
        row.outcome = outcome;
        row.brierBps = brierBps;
      }

      log.info("resolve", "resolved market", {
        marketId: pred.marketId,
        outcome,
        brierBps,
        revealTx: revealTx.txHash,
        recordTx: recordTx.txHash,
      });
    } catch (err) {
      log.error("resolve", "market resolution failed, skipping", {
        marketId: pred.marketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  snapshot.resolutions = resolutions;
  snapshot.reputation = await computeReputation(cfg, resolutions);

  await persistResolutions(cfg, snapshot);
  log.info("resolve", "resolveOnce complete", {
    revealed,
    recorded,
    pending,
    reputation: snapshot.reputation,
  });
  return { revealed, recorded, pending };
}
