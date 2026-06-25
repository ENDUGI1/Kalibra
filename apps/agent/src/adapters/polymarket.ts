import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Market, probToBps } from "@kalibra/shared";
import type { Config } from "../config.js";
import { fetchEspnMarkets } from "./espn.js";
import { toMarketId } from "../lib/hash.js";
import { log } from "../lib/logger.js";
import { findRepoRoot } from "../lib/paths.js";

interface RawFixtureMarket {
  sourceRef: string;
  eventSlug: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  probMarketHome: number;
}

function fixtureToMarket(raw: RawFixtureMarket): Market {
  return {
    marketId: toMarketId(raw.sourceRef),
    source: "fixture",
    sourceRef: raw.sourceRef,
    eventSlug: raw.eventSlug,
    home: raw.home,
    away: raw.away,
    league: raw.league,
    kickoff: raw.kickoff,
    probMarketBps: probToBps(raw.probMarketHome),
  };
}

async function loadFixtures(): Promise<Market[]> {
  const path = join(findRepoRoot(), "apps", "agent", "fixtures", "markets.json");
  const raw = JSON.parse(await readFile(path, "utf-8")) as RawFixtureMarket[];
  return raw.map(fixtureToMarket);
}

/**
 * Best-effort read-only fetch of football markets from the Polymarket Gamma API.
 * This is discovery only — Kalibra never trades. The Gamma response shape varies,
 * so this is intentionally defensive and falls back to fixtures on any problem.
 */
async function fetchLiveMarkets(cfg: Config): Promise<Market[]> {
  const url = new URL("/events", cfg.polymarketApi);
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "20");
  url.searchParams.set("tag", "soccer");

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Gamma API ${res.status} ${res.statusText}`);
  const events = (await res.json()) as unknown[];

  const markets: Market[] = [];
  for (const ev of events) {
    const e = ev as Record<string, unknown>;
    const evMarkets = (e.markets as Record<string, unknown>[] | undefined) ?? [];
    const m = evMarkets[0];
    if (!m) continue;

    // outcomePrices is a JSON-encoded string like "[\"0.52\", \"0.48\"]".
    let homePrice = Number.NaN;
    try {
      const prices = JSON.parse(String(m.outcomePrices ?? "[]")) as string[];
      homePrice = Number.parseFloat(prices[0] ?? "");
    } catch {
      /* leave NaN; skip below */
    }
    if (!Number.isFinite(homePrice)) continue;

    const title = String(e.title ?? m.question ?? "");
    const [home = "HOME", away = "AWAY"] = title.split(/\s+vs\.?\s+/i);
    markets.push({
      marketId: toMarketId(String(m.id ?? e.id ?? title)),
      source: "polymarket",
      sourceRef: String(m.id ?? e.id ?? ""),
      eventSlug: String(e.slug ?? ""),
      home: home.trim().slice(0, 8).toUpperCase(),
      away: away.trim().slice(0, 8).toUpperCase(),
      league: String(e.seriesSlug ?? "Soccer"),
      kickoff: typeof e.startDate === "string" ? e.startDate : undefined,
      probMarketBps: probToBps(homePrice),
    });
  }
  if (markets.length === 0) throw new Error("Gamma API returned no usable soccer markets");
  return markets;
}

/** Return the football markets Kalibra should evaluate this run. */
export async function fetchMarkets(cfg: Config): Promise<Market[]> {
  // ESPN = real fixtures + bookmaker odds (reachable without geo limits).
  if (cfg.marketsSource === "espn") {
    try {
      return await fetchEspnMarkets(cfg);
    } catch (err) {
      log.warn("fetch", "ESPN fetch failed, falling back to fixtures", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // Polymarket Gamma (only where the API is reachable).
  if (cfg.marketsSource === "polymarket" || cfg.polymarketMode === "live") {
    try {
      const markets = await fetchLiveMarkets(cfg);
      log.info("fetch", `loaded ${markets.length} live Polymarket markets`, { mode: "live" });
      return markets;
    } catch (err) {
      log.warn("fetch", "live Polymarket fetch failed, falling back to fixtures", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const markets = await loadFixtures();
  log.info("fetch", `loaded ${markets.length} fixture markets`, { mode: "fixture" });
  return markets;
}
