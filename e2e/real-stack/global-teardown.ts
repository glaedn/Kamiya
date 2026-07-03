import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

export default async function globalTeardown(): Promise<void> {
  if (process.env.KAMIYA_REAL_STACK_KEEP_DB === "1") return;

  const stateFile = process.env.KAMIYA_REAL_STACK_STATE_FILE ?? path.resolve("node_modules/.cache/kamiya-real-stack/state.json");
  const adminDatabaseUrl = process.env.KAMIYA_REAL_STACK_ADMIN_POSTGRES_URL ?? "postgres://postgres@127.0.0.1:5432/postgres";
  const state = JSON.parse(await fs.readFile(stateFile, "utf8")) as {
    launcherPid?: number;
    processes?: Array<{ name?: string; pid?: number }>;
    database?: { name?: string };
  };
  const databaseName = state.database?.name;
  if (!databaseName) return;
  assertSafeDatabaseName(databaseName);
  if (state.launcherPid && state.launcherPid !== process.pid) {
    await killProcessTree(state.launcherPid);
  }
  await delay(600);
  for (const processInfo of [...(state.processes ?? [])].reverse()) {
    if (processInfo.pid) await killProcessTree(processInfo.pid);
  }
  await delay(300);

  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

function assertSafeDatabaseName(databaseName: string): void {
  if (!/(e2e|test)/i.test(databaseName)) {
    throw new Error(`Refusing database operation on unsafe target "${databaseName}".`);
  }
  if (/(prod|production|live)/i.test(databaseName)) {
    throw new Error(`Refusing database operation on production-like target "${databaseName}".`);
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function killProcessTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const child = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
      child.on("exit", () => resolve());
      child.on("error", () => resolve());
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
