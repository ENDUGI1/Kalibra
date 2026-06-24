/**
 * Domain types shared across the agent and the web app.
 *
 * Probabilities are expressed two ways depending on layer:
 *  - `*Bps` fields are integers in [0, 10000] (basis points) — the canonical,
 *    on-chain/DB-safe representation.
 *  - Plain `prob*` floats in [0, 1] appear only at the model service boundary.
 */

/** Lifecycle of a prediction's commit-reveal flow. Mirrors the DB check constraint. */
export type CommitStatus = "pending" | "committed" | "revealed" | "skipped";

/** A football market Kalibra is tracking. */
export interface Market {
  /** On-chain bytes32 market id (0x-prefixed hex). */
  marketId: string;
  source: string;
  /** Venue's native id / slug, if any. */
  sourceRef?: string;
  eventSlug?: string;
  home: string;
  away: string;
  league?: string;
  /** ISO-8601 kickoff time. */
  kickoff?: string;
  /** Market-implied P(home win), basis points. */
  probMarketBps: number;
}

/** Model output for a single market, as returned by the model service. */
export interface ModelForecast {
  marketId: string;
  /** P(home win), float in [0, 1]. */
  probHome: number;
  modelVersion: string;
}

/** Result of comparing the model forecast against the market price. */
export interface EdgeResult {
  marketId: string;
  probModelBps: number;
  probMarketBps: number;
  /** probModelBps - probMarketBps (signed). */
  edgeBps: number;
  /** Whether |edgeBps| >= EDGE_THRESHOLD_BPS. */
  actionable: boolean;
}

/** A committed (or to-be-committed) prediction and its lifecycle. */
export interface Prediction {
  marketId: string;
  probBps: number;
  probMarketBps: number;
  edgeBps: number;
  modelVersion: string;
  /** 0x-prefixed bytes32 salt — secret until reveal. */
  salt: string;
  /** keccak256(abi.encode(probBps, salt)). */
  predictionHash: string;
  status: CommitStatus;
  commitTx?: string;
  committedAt?: string;
}

/** Realized outcome + Brier score after a match settles. */
export interface Resolution {
  marketId: string;
  /** true = home win. */
  outcome: boolean;
  brierBps: number;
  recordTx?: string;
  resolvedAt?: string;
}

/** Aggregate calibration reputation (mirrors the on-chain getter). */
export interface Reputation {
  resolvedCount: number;
  avgBrierBps: number;
}

/**
 * Snapshot the agent writes to the shared state file after a run; the dashboard's
 * mock data layer reads it. Mirrors what the `market_overview` view + on-chain
 * reputation would provide when Supabase/Amoy are live.
 */
export interface PipelineSnapshot {
  updatedAt: string;
  chainMode: "mock" | "amoy";
  reputation: Reputation;
  overview: MarketOverview[];
}

/** Denormalized row backing the dashboard's market table (cf. `market_overview` view). */
export interface MarketOverview {
  marketId: string;
  home: string;
  away: string;
  league?: string;
  kickoff?: string;
  probMarketBps: number;
  probModelBps?: number;
  edgeBps?: number;
  commitStatus?: CommitStatus;
  commitTx?: string;
  committedAt?: string;
  modelVersion?: string;
  outcome?: boolean;
  brierBps?: number;
  resolvedAt?: string;
}
