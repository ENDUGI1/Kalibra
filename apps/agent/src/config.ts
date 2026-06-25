import { EDGE_THRESHOLD_BPS } from "@kalibra/shared";

export type ChainMode = "mock" | "amoy";
export type ModelMode = "service" | "fallback";
export type PolymarketMode = "fixture" | "live";
export type MarketsSource = "fixture" | "polymarket" | "espn";
export type OutcomesSource = "fixture" | "espn";
export type StoreMode = "mock" | "supabase";

export interface Config {
  modelUrl: string;
  modelMode: ModelMode;
  polymarketMode: PolymarketMode;
  polymarketApi: string;
  marketsSource: MarketsSource;
  outcomesSource: OutcomesSource;
  espnApi: string;
  espnLeague: string;
  espnMaxMarkets: number;
  espnIncludeFinished: boolean;
  chainMode: ChainMode;
  rpcUrl: string;
  privateKey?: string;
  contractAddress?: string;
  storeMode: StoreMode;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  edgeThresholdBps: number;
}

function enumEnv<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = process.env[name];
  if (v && allowed.includes(v as T)) return v as T;
  return fallback;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): Config {
  return {
    modelUrl: process.env.MODEL_URL ?? "http://127.0.0.1:8000",
    modelMode: enumEnv("MODEL_MODE", ["service", "fallback"], "service"),
    polymarketMode: enumEnv("POLYMARKET_MODE", ["fixture", "live"], "fixture"),
    polymarketApi: process.env.POLYMARKET_API ?? "https://gamma-api.polymarket.com",
    marketsSource: enumEnv("MARKETS_SOURCE", ["fixture", "polymarket", "espn"], "fixture"),
    outcomesSource: enumEnv("OUTCOMES_SOURCE", ["fixture", "espn"], "fixture"),
    espnApi: process.env.ESPN_API ?? "https://site.api.espn.com",
    espnLeague: process.env.ESPN_LEAGUE ?? "fifa.world",
    espnMaxMarkets: intEnv("ESPN_MAX_MARKETS", 8),
    espnIncludeFinished: process.env.ESPN_INCLUDE_FINISHED === "true",
    chainMode: enumEnv("CHAIN_MODE", ["mock", "amoy"], "mock"),
    rpcUrl: process.env.RPC_URL ?? "https://rpc-amoy.polygon.technology",
    privateKey: process.env.PRIVATE_KEY || undefined,
    contractAddress: process.env.CONTRACT_ADDRESS || undefined,
    storeMode: enumEnv("STORE_MODE", ["mock", "supabase"], "mock"),
    supabaseUrl: process.env.SUPABASE_URL || undefined,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || undefined,
    edgeThresholdBps: intEnv("EDGE_THRESHOLD_BPS", EDGE_THRESHOLD_BPS),
  };
}
