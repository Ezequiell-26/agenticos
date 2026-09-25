import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DurableKernel } from "./kernel/kernel.js";
import { SqliteKernelStore } from "./kernel/sqlite-store.js";
import { SqliteDatabase } from "./kernel/database.js";

const file = process.env.AGENTICOS_DB_PATH ?? path.resolve("data/agenticos.sqlite");
await mkdir(path.dirname(file), { recursive: true });

const database = new SqliteDatabase(file);
const kernel = new DurableKernel(new SqliteKernelStore(database));

const run = kernel.createRun({
  workspaceId: "smoke-workspace",
  budget: {
    maxDurationMs: 60_000,
    maxSteps: 10,
    maxChildAgents: 2,
    maxToolCalls: 20,
    maxTokens: 10_000,
    maxCost: 1,
  },
});
kernel.admitRun(run.id);
const claimed = kernel.claimNext("smoke-worker", 60_000);

console.log(JSON.stringify({
  created: run.id,
  claimed: claimed?.state ?? null,
  database: file,
}, null, 2));

kernel.close();
