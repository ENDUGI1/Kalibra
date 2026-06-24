import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { log } from "./lib/logger.js";
import { runOnce } from "./pipeline.js";
import { resolveOnce } from "./resolve.js";

// Load apps/agent/.env if present (no-op when the file is absent).
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

// Subcommand: `tsx src/index.ts` → commit run; `tsx src/index.ts resolve` → resolve run.
const command = process.argv[2] ?? "run";

// Set exitCode and let the event loop drain naturally. Forcing process.exit()
// here races with tsx/esbuild + undici teardown and trips a libuv assertion on
// Windows, even though the run already succeeded.
async function main() {
  if (command === "resolve") {
    const summary = await resolveOnce();
    log.info("done", "resolve finished", { ...summary });
  } else {
    const summary = await runOnce();
    log.info("done", "pipeline finished", {
      evaluated: summary.evaluated,
      committed: summary.committed,
      skipped: summary.skipped,
    });
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err: unknown) => {
    log.error("done", `${command} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  });
