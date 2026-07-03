import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Market,
  MarketOverview,
  PipelineSnapshot,
  Prediction,
  Reputation,
  Resolution,
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

/**
 * Reputation from chain (amoy) or computed from resolutions. A transient RPC
 * failure must not kill the whole run, so the chain read degrades gracefully.
 */
async function computeReputation(
  cfg: Config,
  resolutions: { brierBps: number }[],
): Promise<Reputation> {
  try {
    const onChain = await readReputation(cfg);
    if (onChain) return onChain;
  } catch (err) {
    log.warn("store", "on-chain reputation read failed, using local computation", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (resolutions.length === 0) return { resolvedCount: 0, avgBrierBps: 0 };
  const sum = resolutions.reduce((s, r) => s + r.brierBps, 0);
  return { resolvedCount: resolutions.length, avgBrierBps: Math.round(sum / resolutions.length) };
}

/** Retry a transient-failure-prone async call (network flakes on CI runners). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        log.warn("store", `${label} failed (attempt ${i}/${attempts}), retrying`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  }
  throw lastErr;
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
  await withRetry(`upsert ${table}`, async () => {
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
  });
}

async function sbPatch(cfg: Config, table: string, match: string, body: unknown): Promise<void> {
  const { url, key } = requireSupabase(cfg);
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set(match.split("=")[0] ?? "", match.split("=")[1] ?? "");
  await withRetry(`patch ${table}`, async () => {
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
  });
}

async function sbGet<T>(cfg: Config, path: string): Promise<T> {
  const { url, key } = requireSupabase(cfg);
  const endpoint = new URL(`/rest/v1/${path}`, url);
  return withRetry(`get ${path.split("?")[0]}`, async () => {
    const res = await fetch(endpoint, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`supabase get ${path} ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  });
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

async function upsertResolutionsToSupabase(cfg: Config, resolutions: Resolution[]): Promise<void> {
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

// --- committed-prediction ledger ------------------------------------------------

/** A committed prediction awaiting resolution, with everything reveal needs. */
export interface CommittedLedgerEntry {
  marketId: string;
  probBps: number;
  salt: string;
  kickoff?: string;
}

/**
 * Load all committed-but-unresolved predictions. In supabase mode the ledger
 * lives in Postgres (CI runners are ephemeral — the local state file does not
 * survive between scheduled runs); otherwise it comes from the local snapshot.
 */
export async function loadCommittedLedger(cfg: Config): Promise<CommittedLedgerEntry[]> {
  if (cfg.storeMode === "supabase") {
    const preds = await sbGet<
      Array<{ market_id: string; prob_bps: number; salt: string }>
    >(cfg, "predictions?status=eq.committed&select=market_id,prob_bps,salt");
    const markets = await sbGet<Array<{ market_id: string; kickoff: string | null }>>(
      cfg,
      "markets?select=market_id,kickoff",
    );
    const kickoffByMarket = new Map(markets.map((m) => [m.market_id, m.kickoff ?? undefined]));
    const ledger = preds.map((p) => ({
      marketId: p.market_id,
      probBps: p.prob_bps,
      salt: p.salt,
      kickoff: kickoffByMarket.get(p.market_id),
    }));
    log.info("store", `loaded ${ledger.length} committed predictions from Supabase`);
    return ledger;
  }

  const snapshot = await loadSnapshot();
  if (!snapshot?.predictions?.length) return [];
  const resolved = new Set((snapshot.resolutions ?? []).map((r) => r.marketId));
  const kickoffByMarket = new Map(snapshot.overview.map((o) => [o.marketId, o.kickoff]));
  return snapshot.predictions
    .filter((p) => p.status === "committed" && !resolved.has(p.marketId))
    .map((p) => ({
      marketId: p.marketId,
      probBps: p.probBps,
      salt: p.salt,
      kickoff: kickoffByMarket.get(p.marketId),
    }));
}

/**
 * Persist freshly recorded resolutions: Supabase in supabase mode, and the local
 * snapshot whenever one exists (keeps the local dashboard in sync). Returns the
 * refreshed reputation.
 */
export async function applyResolutions(
  cfg: Config,
  resolutions: Resolution[],
): Promise<Reputation> {
  if (cfg.storeMode === "supabase" && resolutions.length > 0) {
    await upsertResolutionsToSupabase(cfg, resolutions);
  }

  const snapshot = await loadSnapshot();
  let allResolutions = resolutions;
  if (snapshot) {
    const merged = new Map((snapshot.resolutions ?? []).map((r) => [r.marketId, r]));
    for (const r of resolutions) merged.set(r.marketId, r);
    allResolutions = [...merged.values()];
    for (const r of resolutions) {
      const pred = snapshot.predictions?.find((p) => p.marketId === r.marketId);
      if (pred) pred.status = "revealed";
      const row = snapshot.overview.find((o) => o.marketId === r.marketId);
      if (row) {
        row.commitStatus = "revealed";
        row.outcome = r.outcome;
        row.brierBps = r.brierBps;
      }
    }
  }

  const reputation = await computeReputation(cfg, allResolutions);
  if (snapshot) {
    snapshot.resolutions = allResolutions;
    snapshot.reputation = reputation;
    await writeSnapshot({ ...snapshot, updatedAt: new Date().toISOString() });
    log.info("store", "updated snapshot after resolution", {
      resolved: reputation.resolvedCount,
    });
  }
  return reputation;
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

