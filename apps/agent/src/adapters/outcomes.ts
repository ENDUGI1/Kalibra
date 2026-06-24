import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";
import { toMarketId } from "../lib/hash.js";
import { log } from "../lib/logger.js";
import { findRepoRoot } from "../lib/paths.js";

interface RawOutcome {
  sourceRef: string;
  outcome: boolean;
}

/**
 * Realized outcomes for resolved markets, keyed by on-chain marketId.
 * Phase 0/1: fixture file. A real results feed (sports data API / Polymarket
 * resolution) plugs in here behind the same return shape.
 */
export async function fetchOutcomes(_cfg: Config): Promise<Map<string, boolean>> {
  const path = join(findRepoRoot(), "apps", "agent", "fixtures", "outcomes.json");
  const raw = JSON.parse(await readFile(path, "utf-8")) as RawOutcome[];
  const map = new Map<string, boolean>();
  for (const r of raw) map.set(toMarketId(r.sourceRef), r.outcome);
  log.info("resolve", `loaded ${map.size} fixture outcomes`);
  return map;
}
