// Recreates the SQLite database and loads the seed. Pure Node so it runs on macOS, Windows, and Linux.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" };

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prismaCli = require.resolve("prisma/build/index.js");
run([prismaCli, "db", "push", "--force-reset", "--skip-generate"]);
run(["--import", "tsx", "prisma/seed.ts"]);
