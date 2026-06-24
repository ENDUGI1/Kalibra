import type { PipelineSnapshot } from "@kalibra/shared";

/**
 * Seed snapshot used only when the agent hasn't run and Supabase isn't configured,
 * so the dashboard always renders something. Mirrors the fixture markets. Clearly
 * mock data — replaced by real pipeline output the moment `pnpm agent:run` writes
 * `.data/state.json` (or Supabase is wired up).
 */
export const SEED_SNAPSHOT: PipelineSnapshot = {
  updatedAt: new Date(0).toISOString(),
  chainMode: "mock",
  reputation: { resolvedCount: 2, avgBrierBps: 989 },
  overview: [
    {
      marketId: "0xseed-ars-che",
      home: "ARS",
      away: "CHE",
      league: "EPL",
      kickoff: "2026-08-15T14:00:00Z",
      probMarketBps: 5200,
      probModelBps: 5467,
      edgeBps: 267,
      commitStatus: "skipped",
      modelVersion: "baseline-0.1",
    },
    {
      marketId: "0xseed-mci-liv",
      home: "MCI",
      away: "LIV",
      league: "EPL",
      kickoff: "2026-08-16T15:30:00Z",
      probMarketBps: 5800,
      probModelBps: 3471,
      edgeBps: -2329,
      commitStatus: "revealed",
      commitTx: "0x68b98b8c9fa17e44b0634e1233a67c5fa7f96df7ec53dc89457a551d7c6b2f68",
      committedAt: "2026-06-24T07:17:47.687Z",
      modelVersion: "baseline-0.1",
      outcome: false,
      brierBps: 1205,
    },
    {
      marketId: "0xseed-bay-dor",
      home: "BAY",
      away: "DOR",
      league: "Bundesliga",
      kickoff: "2026-08-29T16:30:00Z",
      probMarketBps: 6400,
      probModelBps: 7223,
      edgeBps: 823,
      commitStatus: "revealed",
      commitTx: "0xdb18bf0382c36c004a81d1ea17b62930091e3245f8bec9d59b82b4807edad2aa",
      committedAt: "2026-06-24T07:17:47.709Z",
      modelVersion: "baseline-0.1",
      outcome: true,
      brierBps: 772,
    },
  ],
};
