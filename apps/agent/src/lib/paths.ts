import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Walk up from a start dir until pnpm-workspace.yaml is found (the repo root). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start); // fell off the top; best-effort
    dir = parent;
  }
}

/**
 * Path to the shared mock state file written by the agent and read by the
 * dashboard's mock data layer. Override with KALIBRA_STATE_FILE.
 */
export function resolveStateFile(): string {
  return process.env.KALIBRA_STATE_FILE ?? join(findRepoRoot(), ".data", "state.json");
}
