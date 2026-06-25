import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";
import { fetchEspnOutcomes } from "./espn.js";
import { toMarketId } from "../lib/hash.js";
import { log } from "../lib/logger.js";
import { findRepoRoot } from "../lib/paths.js";

interface RawOutcome {
  sourceRef: string;
  outcome: boolean;
}

async function fetchFixtureOutcomes(): Promise<Map<string, boolean>> {
  const path = join(findRepoRoot(), "apps", "agent", "fixtures", "outcomes.json");
  const raw = JSON.parse(await readFile(path, "utf-8")) as RawOutcome[];
  const map = new Map<string, boolean>();
  for (const r of raw) map.set(toMarketId(r.sourceRef), r.outcome);
  log.info("resolve", `loaded ${map.size} fixture outcomes`);
  return map;
}

/**
 * Realized outcomes for resolved markets, keyed by on-chain marketId.
 * `espn` = real results (winner flag) from ESPN; `fixture` = local file.
 */
export async function fetchOutcomes(cfg: Config): Promise<Map<string, boolean>> {
  if (cfg.outcomesSource === "espn") {
    try {
      return await fetchEspnOutcomes(cfg);
    } catch (err) {
      log.warn("resolve", "ESPN outcomes failed, falling back to fixtures", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return fetchFixtureOutcomes();
}
