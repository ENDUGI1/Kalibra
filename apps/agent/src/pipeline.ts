import { type Hex } from "viem";
import { type Prediction, computeEdge, probToBps } from "@kalibra/shared";
import { commitPrediction } from "./adapters/chain.js";
import { predict } from "./adapters/model.js";
import { fetchMarkets } from "./adapters/polymarket.js";
import { type RunRecord, persistRun } from "./adapters/store.js";
import { type Config, loadConfig } from "./config.js";
import { generateSalt, hashPrediction } from "./lib/hash.js";
import { log } from "./lib/logger.js";

export interface RunSummary {
  evaluated: number;
  committed: number;
  skipped: number;
  records: RunRecord[];
}

/**
 * Run the full pipeline once: fetch → predict → edge → (commit) → store.
 * Manual trigger for Phase 0 (no scheduler). Per-market failures are isolated so
 * one bad market does not abort the whole run.
 */
export async function runOnce(cfg: Config = loadConfig()): Promise<RunSummary> {
  log.info("pipeline", "runOnce starting", {
    chainMode: cfg.chainMode,
    modelMode: cfg.modelMode,
    polymarketMode: cfg.polymarketMode,
    storeMode: cfg.storeMode,
    edgeThresholdBps: cfg.edgeThresholdBps,
  });

  const markets = await fetchMarkets(cfg);
  const records: RunRecord[] = [];

  for (const market of markets) {
    try {
      const forecast = await predict(cfg, market);
      const probBps = probToBps(forecast.probHome);
      const edge = computeEdge(probBps, market.probMarketBps, cfg.edgeThresholdBps);

      log.info("edge", `${market.home} vs ${market.away}`, {
        probModelBps: probBps,
        probMarketBps: market.probMarketBps,
        edgeBps: edge.edgeBps,
        actionable: edge.actionable,
      });

      const salt = generateSalt();
      const predictionHash = hashPrediction(probBps, salt);
      const prediction: Prediction = {
        marketId: market.marketId,
        probBps,
        probMarketBps: market.probMarketBps,
        edgeBps: edge.edgeBps,
        modelVersion: forecast.modelVersion,
        salt,
        predictionHash,
        status: "pending",
      };

      if (edge.actionable) {
        const commit = await commitPrediction(cfg, market.marketId as Hex, predictionHash);
        prediction.status = "committed";
        prediction.commitTx = commit.txHash;
        prediction.committedAt = new Date().toISOString();
      } else {
        prediction.status = "skipped";
        log.info("commit", "edge below threshold, not committing", {
          marketId: market.marketId,
          edgeBps: edge.edgeBps,
        });
      }

      records.push({ market, prediction });
    } catch (err) {
      log.error("pipeline", "market failed, skipping", {
        marketId: market.marketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await persistRun(cfg, records);

  const committed = records.filter((r) => r.prediction.status === "committed").length;
  const skipped = records.filter((r) => r.prediction.status === "skipped").length;
  const summary: RunSummary = { evaluated: records.length, committed, skipped, records };
  log.info("pipeline", "runOnce complete", { evaluated: summary.evaluated, committed, skipped });
  return summary;
}
