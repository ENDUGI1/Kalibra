import { deriveMetrics, getDashboardData } from "../lib/data";
import { Header } from "../components/Header";
import { MarketsTable } from "../components/MarketsTable";
import { MetricsBar } from "../components/MetricsBar";
import { ReliabilityDiagram } from "../components/ReliabilityDiagram";

// Re-read the state file / Supabase on every request so a fresh agent run shows up.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { snapshot, source } = await getDashboardData();
  const metrics = deriveMetrics(snapshot);

  return (
    <main className="min-h-dvh">
      <Header source={source} updatedAt={snapshot.updatedAt} chainMode={snapshot.chainMode} />
      <MetricsBar metrics={metrics} />

      {source === "seed" ? (
        <div className="border-b border-line bg-elevated">
          <p className="mx-auto max-w-[1400px] px-6 py-2 text-[12px] text-muted">
            Showing seed data.{" "}
            <span className="font-mono text-fg">pnpm agent:run</span> to populate the dashboard with
            live pipeline output.
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <section className="lg:col-span-2 lg:border-r lg:border-line">
            <div className="flex items-baseline justify-between px-6 py-4">
              <h2 className="text-[13px] font-medium text-fg">Active markets</h2>
              <span className="font-mono text-[11px] text-faint tnum">
                {metrics.tracked} tracked · {metrics.committed} committed
              </span>
            </div>
            <MarketsTable rows={snapshot.overview} chainMode={snapshot.chainMode} />
          </section>

          <aside className="border-t border-line lg:col-span-1 lg:border-t-0">
            <ReliabilityDiagram resolvedCount={metrics.resolvedCount} />
          </aside>
        </div>
      </div>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-[1400px] px-6 py-4 text-[11px] leading-relaxed text-faint">
          Kalibra is a market-efficiency &amp; calibration research terminal. It publishes verifiable,
          timestamped forecasts and scores their accuracy — it does not place bets or execute trades.
          Probabilities and Brier scores are shown in percent; committed forecasts are hashed on-chain
          before kickoff to prevent backdating.
        </p>
      </footer>
    </main>
  );
}
