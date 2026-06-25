import { type Market, probToBps } from "@kalibra/shared";
import type { Config } from "../config.js";
import { toMarketId } from "../lib/hash.js";
import { log } from "../lib/logger.js";

/**
 * Real football data via ESPN's public (no-key) soccer API.
 *
 * One source provides everything: real fixtures, real DraftKings moneyline odds
 * (→ market-implied P(home win)), and real results (winner flag). The ESPN event
 * id is the stable key that ties a market to its outcome — no name matching.
 *
 * Note: this is bookmaker odds, not Polymarket. Polymarket's API is geo-blocked
 * in many regions; `polymarket.ts` remains for networks where it is reachable.
 */

const UA = { "User-Agent": "KalibraBot/0.1", accept: "application/json" };

interface EspnCompetitor {
  homeAway: "home" | "away";
  winner?: boolean;
  score?: string;
  team?: { abbreviation?: string; shortDisplayName?: string; displayName?: string };
}
interface EspnEvent {
  id: string;
  date?: string;
  status?: { type?: { name?: string; completed?: boolean } };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
}
interface EspnScoreboard {
  leagues?: Array<{ name?: string }>;
  events?: EspnEvent[];
}

/** American moneyline → implied probability (includes the book's vig). */
function moneylineToProb(ml: number): number {
  return ml > 0 ? 100 / (ml + 100) : -ml / (-ml + 100);
}

/** Vig-removed P(home beats away) by normalising the two moneylines. */
function normalizedHomeProb(homeMl: number, awayMl: number): number {
  const ph = moneylineToProb(homeMl);
  const pa = moneylineToProb(awayMl);
  return ph / (ph + pa);
}

function teamCode(c: EspnCompetitor | undefined): string {
  const t = c?.team;
  return (t?.abbreviation ?? t?.shortDisplayName ?? t?.displayName ?? "?").slice(0, 8).toUpperCase();
}

function sourceRefFor(eventId: string): string {
  return `espn-${eventId}`;
}

async function getScoreboard(cfg: Config): Promise<EspnScoreboard> {
  const url = `${cfg.espnApi}/apis/site/v2/sports/soccer/${cfg.espnLeague}/scoreboard`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status} ${res.statusText}`);
  return (await res.json()) as EspnScoreboard;
}

/** Fetch the home moneyline pair for one event from the summary endpoint. */
async function getHomeProb(cfg: Config, eventId: string): Promise<number | null> {
  const url = `${cfg.espnApi}/apis/site/v2/sports/soccer/${cfg.espnLeague}/summary?event=${eventId}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return null;
  const sm = (await res.json()) as {
    pickcenter?: Array<Record<string, unknown>>;
    odds?: Array<Record<string, unknown>>;
  };
  const o = sm.pickcenter?.[0] ?? sm.odds?.[0];
  const homeMl = (o?.homeTeamOdds as { moneyLine?: number } | undefined)?.moneyLine;
  const awayMl = (o?.awayTeamOdds as { moneyLine?: number } | undefined)?.moneyLine;
  if (typeof homeMl !== "number" || typeof awayMl !== "number") return null;
  return normalizedHomeProb(homeMl, awayMl);
}

/** Real markets to forecast: ESPN soccer matches with bookmaker odds. */
export async function fetchEspnMarkets(cfg: Config): Promise<Market[]> {
  const board = await getScoreboard(cfg);
  const league = board.leagues?.[0]?.name ?? cfg.espnLeague;
  const events = (board.events ?? []).slice(0, cfg.espnMaxMarkets);

  const markets: Market[] = [];
  for (const e of events) {
    // Anti-backdating: only forecast matches that have not finished, unless the
    // caller explicitly opts in (ESPN_INCLUDE_FINISHED=true, for demos/tests).
    if (!cfg.espnIncludeFinished && e.status?.type?.completed) continue;

    const competitors = e.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const probHome = await getHomeProb(cfg, e.id);
    if (probHome == null) continue; // skip matches without usable odds

    markets.push({
      marketId: toMarketId(sourceRefFor(e.id)),
      source: "espn",
      sourceRef: sourceRefFor(e.id),
      eventSlug: e.id,
      home: teamCode(home),
      away: teamCode(away),
      league,
      kickoff: e.date,
      probMarketBps: probToBps(probHome),
    });
  }

  if (markets.length === 0) throw new Error("ESPN returned no soccer markets with odds");
  log.info("fetch", `loaded ${markets.length} ESPN markets`, { league: cfg.espnLeague });
  return markets;
}

/** Real outcomes for finished matches, keyed by marketId (home win = true). */
export async function fetchEspnOutcomes(cfg: Config): Promise<Map<string, boolean>> {
  const board = await getScoreboard(cfg);
  const map = new Map<string, boolean>();
  for (const e of board.events ?? []) {
    if (!e.status?.type?.completed) continue; // only settled matches
    const home = e.competitions?.[0]?.competitors?.find((c) => c.homeAway === "home");
    if (!home) continue;
    map.set(toMarketId(sourceRefFor(e.id)), home.winner === true);
  }
  log.info("resolve", `loaded ${map.size} ESPN outcomes`, { league: cfg.espnLeague });
  return map;
}
