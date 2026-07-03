import { type Hex } from "viem";
import { type Resolution, brierBps as computeBrierBps } from "@kalibra/shared";
import { recordOutcome, revealPrediction } from "./adapters/chain.js";
import { fetchOutcomes } from "./adapters/outcomes.js";
import { applyResolutions, loadCommittedLedger } from "./adapters/store.js";
import { type Config, loadConfig } from "./config.js";
import { log } from "./lib/logger.js";

export interface ResolveSummary {
  revealed: number;
  recorded: number;
  pending: number;
}

/** YYYYMMDD (UTC) for an ISO timestamp. */
function toDateKey(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", "");
}

/**
 * Outcome lookups need the dates the pending matches were played on — the
 * default ESPN scoreboard only covers the current matchday. Past kickoffs up to
 * 30 days back are queried; future kickoffs have no result yet.
 */
function pendingKickoffDates(ledger: { kickoff?: string }[]): string[] {
  const now = Date.now();
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const dates = new Set<string>();
  for (const entry of ledger) {
    if (!entry.kickoff) continue;
    const t = new Date(entry.kickoff).getTime();
    if (Number.isNaN(t) || t > now || now - t > windowMs) continue;
    dates.add(toDateKey(entry.kickoff));
  }
  return [...dates];
}

/**
 * Resolve committed predictions whose outcomes are now known:
 * reveal → compute Brier → recordOutcome, then persist + refresh reputation.
 *
 * The committed ledger comes from Supabase in supabase mode (CI runners are
 * ephemeral, so the local state file cannot carry salts between scheduled runs)
 * and from the local snapshot otherwise. Per-market failures are isolated.
 */
export async function resolveOnce(cfg: Config = loadConfig()): Promise<ResolveSummary> {
  log.info("resolve", "resolveOnce starting", {
    chainMode: cfg.chainMode,
    storeMode: cfg.storeMode,
    outcomesSource: cfg.outcomesSource,
  });

  const ledger = await loadCommittedLedger(cfg);
  if (ledger.length === 0) {
    log.info("resolve", "no committed predictions awaiting resolution");
    return { revealed: 0, recorded: 0, pending: 0 };
  }

  const outcomes = await fetchOutcomes(cfg, pendingKickoffDates(ledger));
  const resolutions: Resolution[] = [];
  let revealed = 0;
  let recorded = 0;
  let pending = 0;

  for (const entry of ledger) {
    const outcome = outcomes.get(entry.marketId);
    if (outcome === undefined) {
      pending += 1;
      continue; // match not settled (or outside the outcome window) yet
    }

    try {
      const marketId = entry.marketId as Hex;
      const revealTx = await revealPrediction(cfg, marketId, entry.probBps, entry.salt as Hex);
      revealed += 1;

      const brierBps = computeBrierBps(entry.probBps, outcome);
      const recordTx = await recordOutcome(cfg, marketId, outcome, brierBps);
      recorded += 1;

      resolutions.push({
        marketId: entry.marketId,
        outcome,
        brierBps,
        recordTx: recordTx.txHash,
        resolvedAt: new Date().toISOString(),
      });

      log.info("resolve", "resolved market", {
        marketId: entry.marketId,
        outcome,
        brierBps,
        revealTx: revealTx.txHash,
        recordTx: recordTx.txHash,
      });
    } catch (err) {
      log.error("resolve", "market resolution failed, skipping", {
        marketId: entry.marketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const reputation = await applyResolutions(cfg, resolutions);
  log.info("resolve", "resolveOnce complete", {
    revealed,
    recorded,
    pending,
    reputation,
  });
  return { revealed, recorded, pending };
}
