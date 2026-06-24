/** Tiny structured logger — one JSON object per line, plus a readable prefix. */

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, step: string, message: string, fields?: Fields): void {
  const record = { ts: new Date().toISOString(), level, step, message, ...fields };
  const line = `[${record.ts}] ${level.toUpperCase().padEnd(5)} ${step.padEnd(10)} ${message}`;
  const detail = fields && Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line + detail);
}

export const log = {
  info: (step: string, message: string, fields?: Fields) => emit("info", step, message, fields),
  warn: (step: string, message: string, fields?: Fields) => emit("warn", step, message, fields),
  error: (step: string, message: string, fields?: Fields) => emit("error", step, message, fields),
};
