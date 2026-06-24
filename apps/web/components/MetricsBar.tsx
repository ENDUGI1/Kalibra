import { bpsToPct } from "../lib/format";

interface Metrics {
  tracked: number;
  committed: number;
  pending: number;
  actionable: number;
  resolvedCount: number;
  avgBrierBps: number;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4">
      <span className="text-[11px] uppercase tracking-wider text-faint">{label}</span>
      <span className="font-mono text-2xl leading-none text-fg tnum">{value}</span>
      {sub ? <span className="text-[11px] text-muted">{sub}</span> : null}
    </div>
  );
}

export function MetricsBar({ metrics }: { metrics: Metrics }) {
  const hasResolutions = metrics.resolvedCount > 0;
  return (
    <section
      aria-label="Calibration reputation"
      className="mx-auto grid max-w-[1400px] grid-cols-2 divide-x divide-y divide-line border-b border-line md:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
    >
      <Stat
        label="Avg Brier"
        value={hasResolutions ? bpsToPct(metrics.avgBrierBps, 1) : "—"}
        sub={hasResolutions ? "lower is better" : "no resolutions yet"}
      />
      <Stat
        label="Calibration"
        value={hasResolutions ? "—" : "—"}
        sub={hasResolutions ? "reliability" : "awaiting outcomes"}
      />
      <Stat label="Resolved" value={String(metrics.resolvedCount)} sub="predictions scored" />
      <Stat label="Open commits" value={String(metrics.pending)} sub="awaiting reveal" />
      <Stat label="Tracked" value={String(metrics.tracked)} sub="active markets" />
      <Stat
        label="Actionable"
        value={String(metrics.actionable)}
        sub={`|edge| ≥ 5.00%`}
      />
    </section>
  );
}
