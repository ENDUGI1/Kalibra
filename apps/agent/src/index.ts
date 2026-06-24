import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { log } from "./lib/logger.js";
import { runOnce } from "./pipeline.js";

// Load apps/agent/.env if present (no-op when the file is absent).
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

// Set exitCode and let the event loop drain naturally. Forcing process.exit()
// here races with tsx/esbuild + undici teardown and trips a libuv assertion on
// Windows, even though the run already succeeded.
runOnce()
  .then((summary) => {
    log.info("done", "pipeline finished", {
      evaluated: summary.evaluated,
      committed: summary.committed,
      skipped: summary.skipped,
    });
    process.exitCode = 0;
  })
  .catch((err: unknown) => {
    log.error("done", "pipeline failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  });
