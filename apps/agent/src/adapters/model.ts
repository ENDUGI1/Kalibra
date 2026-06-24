import { type Market, type ModelForecast, bpsToProb } from "@kalibra/shared";
import type { Config } from "../config.js";
import { log } from "../lib/logger.js";

const FALLBACK_VERSION = "fallback-0.1";

/**
 * Offline fallback forecast: nudge the market price toward 0.5 (mean reversion)
 * so the pipeline produces a non-trivial edge without the model service. Used
 * only when MODEL_MODE=fallback or as a last resort when the service is down.
 */
function fallbackForecast(market: Market): ModelForecast {
  const market_p = bpsToProb(market.probMarketBps);
  const prob = market_p + (0.5 - market_p) * 0.2;
  return { marketId: market.marketId, probHome: prob, modelVersion: FALLBACK_VERSION };
}

async function callService(cfg: Config, market: Market): Promise<ModelForecast> {
  const res = await fetch(new URL("/predict", cfg.modelUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      market_id: market.marketId,
      home: market.home,
      away: market.away,
      features: {},
    }),
  });
  if (!res.ok) throw new Error(`model service ${res.status} ${res.statusText}`);
  const body = (await res.json()) as {
    market_id: string;
    prob_home: number;
    model_version: string;
  };
  return {
    marketId: body.market_id,
    probHome: body.prob_home,
    modelVersion: body.model_version,
  };
}

/** Get a forecast for a market, honoring MODEL_MODE and degrading gracefully. */
export async function predict(cfg: Config, market: Market): Promise<ModelForecast> {
  if (cfg.modelMode === "fallback") return fallbackForecast(market);
  try {
    return await callService(cfg, market);
  } catch (err) {
    log.warn("predict", "model service call failed, using fallback forecast", {
      marketId: market.marketId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackForecast(market);
  }
}
