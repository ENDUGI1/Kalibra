import { bpsToProb } from "@kalibra/shared";

/** Basis points → percentage string, e.g. 5200 → "52.0%". */
export function bpsToPct(bps: number | null | undefined, digits = 1): string {
  if (bps == null) return "—";
  return `${(bpsToProb(bps) * 100).toFixed(digits)}%`;
}

/** Signed edge, e.g. -2329 → "−23.29%". Uses a true minus sign. */
export function formatEdge(bps: number | null | undefined): string {
  if (bps == null) return "—";
  const pct = (bps / 100).toFixed(2);
  if (bps > 0) return `+${pct}%`;
  if (bps < 0) return `−${Math.abs(bps / 100).toFixed(2)}%`;
  return `0.00%`;
}

export type EdgeSign = "pos" | "neg" | "flat";
export function edgeSign(bps: number | null | undefined): EdgeSign {
  if (bps == null || bps === 0) return "flat";
  return bps > 0 ? "pos" : "neg";
}

/** 0x1234…cdef */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** ISO → "Aug 15, 15:30 UTC" (stable, locale-independent). */
export function formatKickoff(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

/** ISO → relative "3m ago" / "2h ago". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
