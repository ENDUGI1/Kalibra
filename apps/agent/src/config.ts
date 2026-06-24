import { EDGE_THRESHOLD_BPS } from "@kalibra/shared";

export type ChainMode = "mock" | "amoy";
export type ModelMode = "service" | "fallback";
export type PolymarketMode = "fixture" | "live";
export type StoreMode = "mock" | "supabase";

export interface Config {
  modelUrl: string;
  modelMode: ModelMode;
  polymarketMode: PolymarketMode;
  polymarketApi: string;
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
