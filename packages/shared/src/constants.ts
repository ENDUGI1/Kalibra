/** Basis-points denominator. Probabilities & Brier scores are integers 0..10000. */
export const BPS_DENOMINATOR = 10_000;

/**
 * Edge threshold for committing a prediction, in basis points.
 * Phase 0 default = 0.05 (500 bps). The agent commits only when
 * |edge| >= this value.
 */
export const EDGE_THRESHOLD_BPS = 500;

/** Polygon Amoy testnet chain id. */
export const AMOY_CHAIN_ID = 80_002;
