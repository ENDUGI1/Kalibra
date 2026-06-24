import type { CommitStatus } from "@kalibra/shared";

const STYLES: Record<CommitStatus, { label: string; dot: string; text: string }> = {
  committed: { label: "Committed", dot: "bg-pos", text: "text-pos" },
  revealed: { label: "Revealed", dot: "bg-pos", text: "text-pos" },
  skipped: { label: "Below threshold", dot: "bg-faint", text: "text-muted" },
  pending: { label: "Pending", dot: "bg-warn", text: "text-warn" },
};

export function StatusBadge({ status }: { status?: CommitStatus }) {
  const s = status ? STYLES[status] : { label: "No prediction", dot: "bg-faint", text: "text-faint" };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      <span className={`text-[12px] ${s.text}`}>{s.label}</span>
    </span>
  );
}
