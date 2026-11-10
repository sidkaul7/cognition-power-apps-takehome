import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Every test file gets its own copy of the empty template database.
const dir = path.resolve(__dirname, "../prisma/test-dbs");
const name = `test-${randomUUID()}.db`;
fs.copyFileSync(path.join(dir, "template.db"), path.join(dir, name));
process.env.DATABASE_URL = `file:./test-dbs/${name}`;
delete (globalThis as { prisma?: unknown }).prisma;
