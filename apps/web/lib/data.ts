import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { MarketOverview, PipelineSnapshot, Reputation } from "@kalibra/shared";
import { SEED_SNAPSHOT } from "./seed";

export type DataSource = "supabase" | "state-file" | "seed";

export interface DashboardData {
  snapshot: PipelineSnapshot;
  source: DataSource;
}

function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

function stateFilePath(): string {
  return process.env.KALIBRA_STATE_FILE ?? join(findRepoRoot(), ".data", "state.json");
}

/** Read the snapshot the agent wrote to the shared state file, if present. */
function readStateFile(): PipelineSnapshot | null {
  const path = stateFilePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PipelineSnapshot;
  } catch {
    return null;
  }
}

/** Read the `market_overview` view from Supabase via PostgREST (no SDK dependency). */
async function readSupabase(url: string, key: string): Promise<PipelineSnapshot | null> {
  try {
    const endpoint = new URL("/rest/v1/market_overview", url);
    endpoint.searchParams.set("select", "*");
    const res = await fetch(endpoint, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, unknown>>;

    const overview: MarketOverview[] = rows.map((r) => ({
      marketId: String(r.market_id),
      home: String(r.home),
      away: String(r.away),
      league: r.league ? String(r.league) : undefined,
      kickoff: r.kickoff ? String(r.kickoff) : undefined,
      probMarketBps: Number(r.prob_market_bps ?? 0),
      probModelBps: r.prob_model_bps == null ? undefined : Number(r.prob_model_bps),
      edgeBps: r.edge_bps == null ? undefined : Number(r.edge_bps),
      commitStatus: r.commit_status as MarketOverview["commitStatus"],
      commitTx: r.commit_tx ? String(r.commit_tx) : undefined,
      committedAt: r.committed_at ? String(r.committed_at) : undefined,
      modelVersion: r.model_version ? String(r.model_version) : undefined,
      outcome: r.outcome == null ? undefined : Boolean(r.outcome),
      brierBps: r.brier_bps == null ? undefined : Number(r.brier_bps),
      resolvedAt: r.resolved_at ? String(r.resolved_at) : undefined,
    }));

    const resolved = overview.filter((o) => o.brierBps != null);
    const reputation: Reputation = {
      resolvedCount: resolved.length,
      avgBrierBps: resolved.length
        ? Math.round(resolved.reduce((s, o) => s + (o.brierBps ?? 0), 0) / resolved.length)
        : 0,
    };
    return { updatedAt: new Date().toISOString(), chainMode: "amoy", reputation, overview };
  } catch {
    return null;
  }
}

/**
 * Load dashboard data. Precedence: Supabase (if configured) → agent state file →
 * seed. Never hardcodes data in components; this is the single data layer.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    const snap = await readSupabase(url, key);
    if (snap) return { snapshot: snap, source: "supabase" };
  }

  const fromFile = readStateFile();
  if (fromFile) return { snapshot: fromFile, source: "state-file" };

  return { snapshot: SEED_SNAPSHOT, source: "seed" };
}

/** Derived header metrics from a snapshot. */
export function deriveMetrics(snapshot: PipelineSnapshot) {
  const { overview, reputation } = snapshot;
  const committed = overview.filter(
    (o) => o.commitStatus === "committed" || o.commitStatus === "revealed",
  ).length;
  const pending = overview.filter(
    (o) => o.commitStatus === "committed" && o.brierBps == null,
  ).length;
  const actionable = overview.filter(
    (o) => o.edgeBps != null && Math.abs(o.edgeBps) >= 500,
  ).length;
  const withEdge = overview.filter((o) => o.edgeBps != null);
  const avgEdgeBps = withEdge.length
    ? Math.round(withEdge.reduce((s, o) => s + Math.abs(o.edgeBps ?? 0), 0) / withEdge.length)
    : 0;
  return {
    tracked: overview.length,
    committed,
    pending,
    actionable,
    avgEdgeBps,
    resolvedCount: reputation.resolvedCount,
    avgBrierBps: reputation.avgBrierBps,
  };
}

/** Resolved (forecast, outcome) pairs for the reliability diagram. */
export function reliabilityPoints(snapshot: PipelineSnapshot) {
  return snapshot.overview
    .filter((o) => o.outcome != null && o.probModelBps != null)
    .map((o) => ({ probBps: o.probModelBps as number, outcome: o.outcome as boolean }));
}
