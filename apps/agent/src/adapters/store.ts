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

/** Persist this run by overwriting the shared snapshot the dashboard reads. */
async function persistMock(cfg: Config, records: RunRecord[]): Promise<void> {
  const path = resolveStateFile();
  const committed = records.filter((r) => r.prediction.status === "committed").length;
  const snapshot: PipelineSnapshot = {
    updatedAt: new Date().toISOString(),
    chainMode: cfg.chainMode,
    // Phase 0 has no automated resolution yet, so reputation starts empty.
    reputation: { resolvedCount: 0, avgBrierBps: 0 } satisfies Reputation,
    overview: records.map(toOverview),
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
  log.info("store", "wrote snapshot to state file", { path, markets: records.length, committed });
}

/**
 * Best-effort Supabase persistence via PostgREST upsert. Phase 0 default is mock;
 * this path is wired but not the validated route until a live project exists.
 */
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

/** Read back the current snapshot (used by tooling/tests); null if none yet. */
export async function readSnapshot(): Promise<PipelineSnapshot | null> {
  try {
    return JSON.parse(await readFile(resolveStateFile(), "utf-8")) as PipelineSnapshot;
  } catch {
    return null;
  }
}
