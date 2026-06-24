import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Market,
  MarketOverview,
  PipelineSnapshot,
  Prediction,
  Reputation,
} from "@kalibra/shared";
import type { Config } from "../config.js";
import { readReputation } from "./chain.js";
import { log } from "../lib/logger.js";
import { resolveStateFile } from "../lib/paths.js";

export interface RunRecord {
  market: Market;
  prediction: Prediction;
}

function toOverview(rec: RunRecord): MarketOverview {
  const { market, prediction } = rec;
  return {
    marketId: market.marketId,
    home: market.home,
    away: market.away,
    league: market.league,
    kickoff: market.kickoff,
    probMarketBps: market.probMarketBps,
    probModelBps: prediction.probBps,
    edgeBps: prediction.edgeBps,
    commitStatus: prediction.status,
    commitTx: prediction.commitTx,
    committedAt: prediction.committedAt,
    modelVersion: prediction.modelVersion,
  };
}

/** Reputation from chain (amoy) or computed from resolutions (mock). */
async function computeReputation(
  cfg: Config,
  resolutions: { brierBps: number }[],
): Promise<Reputation> {
  const onChain = await readReputation(cfg);
  if (onChain) return onChain;
  if (resolutions.length === 0) return { resolvedCount: 0, avgBrierBps: 0 };
  const sum = resolutions.reduce((s, r) => s + r.brierBps, 0);
  return { resolvedCount: resolutions.length, avgBrierBps: Math.round(sum / resolutions.length) };
}

async function writeSnapshot(snapshot: PipelineSnapshot): Promise<void> {
  const path = resolveStateFile();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
}

/** Persist a fresh commit run, including the secret-salt ledger for later reveal. */
async function persistMock(cfg: Config, records: RunRecord[]): Promise<void> {
  const reputation = await computeReputation(cfg, []);
  const snapshot: PipelineSnapshot = {
    updatedAt: new Date().toISOString(),
    chainMode: cfg.chainMode,
    reputation,
    overview: records.map(toOverview),
    predictions: records.map((r) => r.prediction),
    resolutions: [],
  };
  await writeSnapshot(snapshot);
  const committed = records.filter((r) => r.prediction.status === "committed").length;
  log.info("store", "wrote snapshot to state file", {
    path: resolveStateFile(),
    markets: records.length,
    committed,
  });
}

/** Read the current snapshot (the salt ledger lives here). */
export async function loadSnapshot(): Promise<PipelineSnapshot | null> {
  try {
    return JSON.parse(await readFile(resolveStateFile(), "utf-8")) as PipelineSnapshot;
  } catch {
    return null;
  }
}

/** Rewrite the snapshot after resolution updates (overview/reputation/resolutions). */
export async function persistSnapshot(snapshot: PipelineSnapshot): Promise<void> {
  await writeSnapshot({ ...snapshot, updatedAt: new Date().toISOString() });
  log.info("store", "updated snapshot after resolution", {
    resolved: snapshot.reputation.resolvedCount,
  });
}

export { computeReputation };

/** Best-effort Supabase persistence via PostgREST upsert (commit run only). */
async function persistSupabase(cfg: Config, records: RunRecord[]): Promise<void> {
  if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
    throw new Error("STORE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_KEY");
  }
  const headers = {
    "content-type": "application/json",
    apikey: cfg.supabaseServiceKey,
    authorization: `Bearer ${cfg.supabaseServiceKey}`,
    prefer: "resolution=merge-duplicates",
  };
  const upsert = async (table: string, rows: unknown[], onConflict: string) => {
    const url = new URL(`/rest/v1/${table}`, cfg.supabaseUrl);
    url.searchParams.set("on_conflict", onConflict);
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(rows) });
    if (!res.ok) throw new Error(`supabase ${table} upsert ${res.status}: ${await res.text()}`);
  };
  await upsert(
    "markets",
    records.map((r) => ({
      market_id: r.market.marketId,
      source: r.market.source,
      source_ref: r.market.sourceRef,
      event_slug: r.market.eventSlug,
      home: r.market.home,
      away: r.market.away,
      league: r.market.league,
      kickoff: r.market.kickoff,
      prob_market_bps: r.market.probMarketBps,
    })),
    "market_id",
  );
  await upsert(
    "predictions",
    records.map((r) => ({
      market_id: r.market.marketId,
      prob_bps: r.prediction.probBps,
      prob_market_bps: r.prediction.probMarketBps,
      edge_bps: r.prediction.edgeBps,
      model_version: r.prediction.modelVersion,
      salt: r.prediction.salt,
      prediction_hash: r.prediction.predictionHash,
      status: r.prediction.status,
      commit_tx: r.prediction.commitTx,
      committed_at: r.prediction.committedAt,
    })),
    "market_id",
  );
  log.info("store", "upserted run to Supabase", { markets: records.length });
}

export async function persistRun(cfg: Config, records: RunRecord[]): Promise<void> {
  if (cfg.storeMode === "supabase") return persistSupabase(cfg, records);
  return persistMock(cfg, records);
}
