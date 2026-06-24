import { bpsToProb } from "@kalibra/shared";

interface Point {
  probBps: number;
  outcome: boolean;
}

interface Bin {
  meanForecast: number;
  observed: number;
  count: number;
}

/** Group resolved forecasts into 5 probability bins and compute observed frequency. */
function binPoints(points: Point[]): Bin[] {
  const bins: Bin[] = [];
  for (let b = 0; b < 5; b += 1) {
    const lo = b * 0.2;
    const hi = lo + 0.2;
    const inBin = points.filter((p) => {
      const prob = bpsToProb(p.probBps);
      return prob >= lo && (b === 4 ? prob <= hi : prob < hi);
    });
    if (inBin.length === 0) continue;
    const meanForecast = inBin.reduce((s, p) => s + bpsToProb(p.probBps), 0) / inBin.length;
    const observed = inBin.filter((p) => p.outcome).length / inBin.length;
    bins.push({ meanForecast, observed, count: inBin.length });
  }
  return bins;
}

/**
 * Reliability (calibration) diagram. Plots observed frequency vs. forecast
 * probability per bin against the perfect-calibration diagonal. Empty state until
 * predictions resolve.
 */
export function ReliabilityDiagram({ points }: { points: Point[] }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const pad = 10;
  const lo = pad;
  const hi = 100 - pad;
  const toX = (t: number) => lo + t * (hi - lo);
  const toY = (t: number) => hi - t * (hi - lo);
  const bins = binPoints(points);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-6 py-4">
        <h2 className="text-[13px] font-medium text-fg">Reliability diagram</h2>
        <span className="text-[11px] text-faint">
          {points.length > 0 ? `${points.length} resolved` : "forecast vs. observed"}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[420px] px-6 pb-2 lg:max-w-none">
        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full"
          role="img"
          aria-label={
            points.length > 0
              ? `Calibration plot with ${bins.length} binned points against the perfect-calibration diagonal.`
              : "Calibration plot. No resolved predictions yet."
          }
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={toX(t)} y1={lo} x2={toX(t)} y2={hi} stroke="var(--line)" strokeWidth={0.3} />
              <line x1={lo} y1={toY(t)} x2={hi} y2={toY(t)} stroke="var(--line)" strokeWidth={0.3} />
            </g>
          ))}
          <rect
            x={lo}
            y={lo}
            width={hi - lo}
            height={hi - lo}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={0.4}
          />
          <line
            x1={toX(0)}
            y1={toY(0)}
            x2={toX(1)}
            y2={toY(1)}
            stroke="var(--muted)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />

          {/* connecting calibration line */}
          {bins.length > 1 ? (
            <polyline
              points={bins.map((b) => `${toX(b.meanForecast)},${toY(b.observed)}`).join(" ")}
              fill="none"
              stroke="var(--pos)"
              strokeWidth={0.6}
            />
          ) : null}
          {/* binned points; radius scales with sample count */}
          {bins.map((b) => (
            <circle
              key={b.meanForecast}
              cx={toX(b.meanForecast)}
              cy={toY(b.observed)}
              r={Math.min(3.2, 1.6 + b.count * 0.5)}
              fill="var(--pos)"
              stroke="var(--bg)"
              strokeWidth={0.4}
            />
          ))}
        </svg>

        {points.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <div className="rounded-md border border-line bg-panel/80 px-3 py-2 text-center backdrop-blur-sm">
              <p className="text-[12px] text-muted">Awaiting resolved predictions</p>
              <p className="mt-0.5 text-[11px] text-faint">
                run <span className="font-mono">agent:resolve</span> after outcomes are known
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4 px-6 pb-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dashed border-muted" aria-hidden />
          perfect calibration
        </span>
        {points.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
            observed
          </span>
        ) : null}
        <span className="text-faint">x: forecast · y: observed</span>
      </div>
    </div>
  );
}
