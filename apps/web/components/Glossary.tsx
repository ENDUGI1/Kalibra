const TERMS: Array<{ term: string; def: string }> = [
  {
    term: "Market prob",
    def: "The market's implied chance of a home win, derived from prices/odds. What the crowd believes.",
  },
  {
    term: "Model prob",
    def: "Kalibra's own forecast of a home win, produced before kickoff.",
  },
  {
    term: "Edge",
    def: "Model prob minus market prob. Green: the model is more confident in the home side than the market; red: less. Only |edge| ≥ 5% gets committed.",
  },
  {
    term: "Commit",
    def: "A hash of the forecast is written on-chain before kickoff, so the prediction can't be altered or backdated. “Revealed” means the forecast was later opened and scored.",
  },
  {
    term: "Brier score",
    def: "Accuracy grade for a resolved forecast: (forecast − outcome)². Lower is better — 0% is perfect, 25% is coin-flip guessing.",
  },
  {
    term: "Avg Brier",
    def: "Mean Brier score across all resolved predictions. The agent's headline report card.",
  },
  {
    term: "Open commits",
    def: "Forecasts locked on-chain whose matches haven't finished yet — awaiting scoring.",
  },
  {
    term: "Reliability diagram",
    def: "Honesty check: when the model says 70%, does it actually happen ~70% of the time? Points on the dashed line = well-calibrated.",
  },
  {
    term: "Tx",
    def: "The blockchain transaction receipt for a commit — a public, tamper-proof timestamp anyone can verify.",
  },
];

/** Plain-language definitions for the dashboard's terminology. */
export function Glossary() {
  return (
    <section className="border-t border-line">
      <details className="group mx-auto max-w-[1400px] px-6 py-4">
        <summary className="cursor-pointer list-none text-[13px] font-medium text-muted transition-colors hover:text-fg">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
          What am I looking at? — glossary
        </summary>
        <dl className="mt-4 grid grid-cols-1 gap-x-10 gap-y-3 pb-2 md:grid-cols-2 lg:grid-cols-3">
          {TERMS.map(({ term, def }) => (
            <div key={term} className="flex flex-col gap-0.5">
              <dt className="text-[12px] font-medium text-fg">{term}</dt>
              <dd className="text-[12px] leading-relaxed text-muted">{def}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
