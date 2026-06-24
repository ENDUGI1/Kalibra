import type { DataSource } from "../lib/data";
import { timeAgo } from "../lib/format";

const SOURCE_LABEL: Record<DataSource, string> = {
  supabase: "supabase",
  "state-file": "pipeline",
  seed: "seed (run agent)",
};

export function Header({
  source,
  updatedAt,
  chainMode,
}: {
  source: DataSource;
  updatedAt: string;
  chainMode: "mock" | "amoy";
}) {
  const live = source !== "seed";
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-fg">
            Kalibra
          </span>
          <span className="hidden text-[13px] text-muted sm:inline">
            Forecasting &amp; Calibration Terminal
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-pos" : "bg-faint"}`}
              aria-hidden
            />
            {live ? "live" : "idle"}
          </span>
          <span className="text-faint">·</span>
          <span>
            chain: <span className="text-fg">{chainMode}</span>
          </span>
          <span className="text-faint">·</span>
          <span>
            src: <span className="text-fg">{SOURCE_LABEL[source]}</span>
          </span>
          <span className="hidden text-faint sm:inline">·</span>
          <span className="hidden sm:inline tnum">{timeAgo(updatedAt)}</span>
        </div>
      </div>
    </header>
  );
}
