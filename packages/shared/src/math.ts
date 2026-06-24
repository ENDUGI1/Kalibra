import { BPS_DENOMINATOR, EDGE_THRESHOLD_BPS } from "./constants";
import type { EdgeResult } from "./types";

/** Convert a probability in [0, 1] to basis points [0, 10000] (rounded, clamped). */
export function probToBps(prob: number): number {
  const bps = Math.round(prob * BPS_DENOMINATOR);
  return Math.min(BPS_DENOMINATOR, Math.max(0, bps));
}

/** Convert basis points [0, 10000] back to a probability in [0, 1]. */
export function bpsToProb(bps: number): number {
  return bps / BPS_DENOMINATOR;
}

/**
 * Compute the edge between the model forecast and the market price.
 * Positive edge = the model thinks home win is more likely than the market prices.
 */
export function computeEdge(
  probModelBps: number,
  probMarketBps: number,
  thresholdBps: number = EDGE_THRESHOLD_BPS,
): EdgeResult & { marketId: string } {
  const edgeBps = probModelBps - probMarketBps;
  return {
    marketId: "",
    probModelBps,
    probMarketBps,
    edgeBps,
    actionable: Math.abs(edgeBps) >= thresholdBps,
  };
}

/**
 * Brier score for a binary forecast, in basis points.
 * brier = (p - outcome)^2, outcome ∈ {0, 1}; range [0, 10000] (0 = perfect).
 */
export function brierBps(probBps: number, outcome: boolean): number {
  const p = bpsToProb(probBps);
  const o = outcome ? 1 : 0;
  const brier = (p - o) ** 2; // [0, 1]
  return Math.round(brier * BPS_DENOMINATOR);
}
