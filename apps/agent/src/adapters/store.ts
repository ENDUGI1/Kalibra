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

export { computeReputation };

// --- local state file (the secret-salt ledger always lives here) ---------------

async function writeSnapshot(snapshot: PipelineSnapshot): Promise<void> {
  const path = resolveStateFile();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
}

/** Read the current snapshot (the salt ledger). */
export async function loadSnapshot(): Promise<PipelineSnapshot | null> {
  try {
    return JSON.parse(await readFile(resolveStateFile(), "utf-8")) as PipelineSnapshot;
  } catch {
    return null;
  }
}

// --- Supabase REST (PostgREST) -------------------------------------------------
// Writes require the service-role key (anon is read-only on the view per RLS).
// The salt stays in the local ledger and the service-role-only predictions table;
// it is never exposed publicly.

function requireSupabase(cfg: Config): { url: string; key: string } {
  if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
    throw new Error("STORE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_KEY");
  }
  return { url: cfg.supabaseUrl, key: cfg.supabaseServiceKey };
}

async function sbUpsert(
  cfg: Config,
  table: string,
  rows: unknown[],
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const { url, key } = requireSupabase(cfg);
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set("on_conflict", onConflict);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: key,
      authorization: `Bearer ${key}`,
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`supabase ${table} upsert ${res.status}: ${await res.text()}`);
}

async function sbPatch(cfg: Config, table: string, match: string, body: unknown): Promise<void> {
  const { url, key } = requireSupabase(cfg);
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set(match.split("=")[0] ?? "", match.split("=")[1] ?? "");
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      apikey: key,
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase ${table} patch ${res.status}: ${await res.text()}`);
}

async function upsertRunToSupabase(cfg: Config, records: RunRecord[]): Promise<void> {
  await sbUpsert(
    cfg,
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
  await sbUpsert(
    cfg,
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

async function upsertResolutionsToSupabase(cfg: Config, snapshot: PipelineSnapshot): Promise<void> {
  const resolutions = snapshot.resolutions ?? [];
  await sbUpsert(
    cfg,
    "resolutions",
    resolutions.map((r) => ({
      market_id: r.marketId,
      outcome: r.outcome,
      brier_bps: r.brierBps,
      record_tx: r.recordTx,
      resolved_at: r.resolvedAt,
    })),
    "market_id",
  );
  // Flip resolved predictions to 'revealed' so market_overview reflects status.
  for (const r of resolutions) {
    await sbPatch(cfg, "predictions", `market_id=eq.${r.marketId}`, { status: "revealed" });
  }
  log.info("store", "upserted resolutions to Supabase", { resolved: resolutions.length });
}

// --- public API ---------------------------------------------------------------

/**
 * Persist a fresh commit run. The local state file is always written (it is the
 * salt ledger the resolve step reads); in supabase mode the public columns are
 * also mirrored to Postgres.
 */
export async function persistRun(cfg: Config, records: RunRecord[]): Promise<void> {
  const snapshot: PipelineSnapshot = {
    updatedAt: new Date().toISOString(),
    chainMode: cfg.chainMode,
    reputation: await computeReputation(cfg, []),
    overview: records.map(toOverview),
    predictions: records.map((r) => r.prediction),
    resolutions: [],
  };
  await writeSnapshot(snapshot);
  log.info("store", "wrote snapshot to state file", {
    path: resolveStateFile(),
    markets: records.length,
    committed: records.filter((r) => r.prediction.status === "committed").length,
  });
  if (cfg.storeMode === "supabase") await upsertRunToSupabase(cfg, records);
}

/** Persist resolution updates: always to the local file, plus Supabase if enabled. */
export async function persistResolutions(cfg: Config, snapshot: PipelineSnapshot): Promise<void> {
  await writeSnapshot({ ...snapshot, updatedAt: new Date().toISOString() });
  log.info("store", "updated snapshot after resolution", {
    resolved: snapshot.reputation.resolvedCount,
  });
  if (cfg.storeMode === "supabase") await upsertResolutionsToSupabase(cfg, snapshot);
}
