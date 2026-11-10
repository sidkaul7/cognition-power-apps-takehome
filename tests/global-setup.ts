import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dir = path.resolve(__dirname, "../prisma/test-dbs");

// Builds one empty template database; each test file copies it (see tests/setup.ts).
export function setup() {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: "file:./test-dbs/template.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`prisma db push failed:\n${result.stdout}\n${result.stderr}`);
}

export function teardown() {
  fs.rmSync(dir, { recursive: true, force: true });
}
