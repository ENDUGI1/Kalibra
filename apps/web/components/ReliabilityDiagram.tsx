/**
 * Reliability (calibration) diagram. Phase 0 placeholder: the axes, perfect-
 * calibration reference line, and empty state are real; binned observed-frequency
 * points appear once predictions resolve and Brier scores exist.
 */
export function ReliabilityDiagram({ resolvedCount }: { resolvedCount: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  // Plot geometry in a 0..100 user space; CSS sizes it responsively.
  const pad = 10;
  const lo = pad;
  const hi = 100 - pad;
  const toX = (t: number) => lo + t * (hi - lo);
  const toY = (t: number) => hi - t * (hi - lo);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-6 py-4">
        <h2 className="text-[13px] font-medium text-fg">Reliability diagram</h2>
        <span className="text-[11px] text-faint">forecast vs. observed</span>
      </div>

      <div className="relative mx-auto w-full max-w-[420px] px-6 pb-2 lg:max-w-none">
        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full"
          role="img"
          aria-label="Calibration plot: forecast probability versus observed frequency. No resolved predictions yet."
        >
          {/* grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={toX(t)}
                y1={lo}
                x2={toX(t)}
                y2={hi}
                stroke="var(--line)"
                strokeWidth={0.3}
              />
              <line
                x1={lo}
                y1={toY(t)}
                x2={hi}
                y2={toY(t)}
                stroke="var(--line)"
                strokeWidth={0.3}
              />
            </g>
          ))}
          {/* plot frame */}
          <rect
            x={lo}
            y={lo}
            width={hi - lo}
            height={hi - lo}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={0.4}
          />
          {/* perfect-calibration reference */}
          <line
            x1={toX(0)}
            y1={toY(0)}
            x2={toX(1)}
            y2={toY(1)}
            stroke="var(--muted)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        </svg>

        {resolvedCount === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <div className="rounded-md border border-line bg-panel/80 px-3 py-2 text-center backdrop-blur-sm">
              <p className="text-[12px] text-muted">Awaiting resolved predictions</p>
              <p className="mt-0.5 text-[11px] text-faint">
                points plot once outcomes are recorded
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4 px-6 pb-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-4 border-t border-dashed border-muted"
            aria-hidden
          />
          perfect calibration
        </span>
        <span className="text-faint">x: forecast · y: observed</span>
      </div>
    </div>
  );
}
