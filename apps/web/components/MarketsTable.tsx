import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { MarketOverview } from "@kalibra/shared";
import { bpsToPct, edgeSign, formatEdge, formatKickoff, shortHash } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

const EDGE_COLOR = {
  pos: "text-pos",
  neg: "text-neg",
  flat: "text-muted",
} as const;

function TxCell({ tx, chainMode }: { tx?: string; chainMode: "mock" | "amoy" }) {
  if (!tx) return <span className="text-faint">—</span>;
  if (chainMode === "amoy") {
    return (
      <a
        href={`https://amoy.polygonscan.com/tx/${tx}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        {shortHash(tx)}
        <ArrowUpRight size={11} weight="bold" aria-hidden />
      </a>
    );
  }
  return <span className="font-mono text-[12px] text-muted">{shortHash(tx)}</span>;
}

export function MarketsTable({
  rows,
  chainMode,
}: {
  rows: MarketOverview[];
  chainMode: "mock" | "amoy";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
            <th scope="col" className="px-6 py-2.5 font-medium">
              Event
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Kickoff
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Mkt prob
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Model prob
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Edge
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Commit
            </th>
            <th scope="col" className="px-6 py-2.5 text-right font-medium">
              Tx
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.marketId}
              className="border-b border-line/70 transition-colors hover:bg-elevated"
            >
              <td className="px-6 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-medium text-fg">{r.home}</span>
                  <span className="text-[11px] text-faint">v</span>
                  <span className="font-mono font-medium text-fg">{r.away}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{r.league ?? "—"}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[12px] text-muted tnum">
                {formatKickoff(r.kickoff)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-fg tnum">
                {bpsToPct(r.probMarketBps)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-fg tnum">
                {bpsToPct(r.probModelBps)}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono tnum ${EDGE_COLOR[edgeSign(r.edgeBps)]}`}
              >
                {formatEdge(r.edgeBps)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.commitStatus} />
              </td>
              <td className="px-6 py-3 text-right">
                <TxCell tx={r.commitTx} chainMode={chainMode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
