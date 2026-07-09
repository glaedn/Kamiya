import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;
const requiredCerbanimoCommit = "091f7ee45a440cef686e71eea68d677272b88855";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface Ports {
  webPort: number;
  apiPort: number;
  cerbanimoPort: number;
}

interface ChildHandle {
  name: string;
  process: ChildProcessWithoutNullStreams;
  logFile: fs.WriteStream;
}

const args = parseArgs(process.argv.slice(2));
const ports: Ports = {
  webPort: Number(args["web-port"] ?? process.env.KAMIYA_REAL_STACK_WEB_PORT ?? 5179),
  apiPort: Number(args["api-port"] ?? process.env.KAMIYA_REAL_STACK_API_PORT ?? 4181),
  cerbanimoPort: Number(args["cerbanimo-port"] ?? process.env.KAMIYA_REAL_STACK_CERBANIMO_PORT ?? 4401)
};
const stateFile = path.resolve(String(args["state-file"] ?? process.env.KAMIYA_REAL_STACK_STATE_FILE ?? path.join(rootDir, "node_modules/.cache/kamiya-real-stack/state.json")));
const artifactDir = path.resolve("artifacts/golden-conversation");
const runId = `kamiya_e2e_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${crypto.randomBytes(3).toString("hex")}`;
const controlDir = path.join(path.dirname(stateFile), "provider-control", runId);
const adminDatabaseUrl = process.env.KAMIYA_REAL_STACK_ADMIN_POSTGRES_URL ?? "postgres://postgres@127.0.0.1:5432/postgres";
const e2eDatabaseName = safeDatabaseName(runId);
const e2eDatabaseUrl = databaseUrlFor(adminDatabaseUrl, e2eDatabaseName);
const cerbanimoRepoRoot = resolveCerbanimoRepoRoot();
const children: ChildHandle[] = [];
let shuttingDown = false;

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("uncaughtException", (error) => {
  console.error("[real-stack] uncaught exception:", error);
  void shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error("[real-stack] unhandled rejection:", error);
  void shutdown(1);
});

await main().catch((error: unknown) => {
  console.error("[real-stack] startup failed:", error);
  void shutdown(1);
});

async function main(): Promise<void> {
  await fsp.mkdir(artifactDir, { recursive: true });
  await fsp.mkdir(path.dirname(stateFile), { recursive: true });
  await fsp.mkdir(controlDir, { recursive: true });

  const cerbanimoCommit = await gitCommit(cerbanimoRepoRoot);
  const acceptedCerbanimo = cerbanimoCommit === requiredCerbanimoCommit || await isGitAncestor(requiredCerbanimoCommit, "HEAD", cerbanimoRepoRoot);
  if (!acceptedCerbanimo && process.env.KAMIYA_ALLOW_CERBANIMO_DESCENDANT !== "1") {
    throw new Error(`Cerbanimo checkout must be ${requiredCerbanimoCommit} or a reviewed descendant; found ${cerbanimoCommit}.`);
  }

  const kamiyaCommit = await gitCommit(rootDir).catch(() => "unknown");
  await createIsolatedDatabase();
  const actors = await initializeCerbanimoSchemaAndSeedActors();

  const state = {
    runId,
    createdAt: new Date().toISOString(),
    launcherPid: process.pid,
    stateFile,
    artifactDir,
    controlDir,
    cerbanimoRepoRoot,
    cerbanimoCommit,
    kamiyaCommit,
    webPort: ports.webPort,
    apiPort: ports.apiPort,
    cerbanimoPort: ports.cerbanimoPort,
    cerbanimoOrigin: `http://127.0.0.1:${ports.cerbanimoPort}`,
    cerbanimoApiBase: `http://127.0.0.1:${ports.cerbanimoPort}`,
    database: {
      url: e2eDatabaseUrl,
      host: safeDatabaseTarget(e2eDatabaseUrl).host,
      name: e2eDatabaseName
    },
    actors
  };
  await fsp.writeFile(stateFile, JSON.stringify(state, null, 2));

  startProcesses();
  await fsp.writeFile(stateFile, JSON.stringify({
    ...state,
    processes: children.map((child) => ({ name: child.name, pid: child.process.pid }))
  }, null, 2));
  await waitForUrl(`http://127.0.0.1:${ports.cerbanimoPort}/api/health`, "Cerbanimo E2E API");
  await waitForUrl(`http://127.0.0.1:${ports.apiPort}/api/health`, "Kamiya API");
  await waitForUrl(`http://127.0.0.1:${ports.webPort}/api/health`, "Kamiya Vite proxy");

  console.log(`[real-stack] ready: web=http://127.0.0.1:${ports.webPort}, cerbanimo=http://127.0.0.1:${ports.cerbanimoPort}, db=${redactDatabaseUrl(e2eDatabaseUrl)}`);
  await new Promise(() => {});
}

async function createIsolatedDatabase(): Promise<void> {
  assertSafeDatabaseName(e2eDatabaseName);
  console.log(`[real-stack] creating isolated database host=${safeDatabaseTarget(adminDatabaseUrl).host} db=${e2eDatabaseName}`);
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(e2eDatabaseName)} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${quoteIdentifier(e2eDatabaseName)}`);
  } finally {
    await client.end();
  }
}

async function initializeCerbanimoSchemaAndSeedActors() {
  process.env.POSTGRES_URL = e2eDatabaseUrl;
  process.env.DATABASE_URL = e2eDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.CERBANIMO_E2E_MODE = "true";

  const client = new Client({ connectionString: e2eDatabaseUrl });
  await client.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  } finally {
    await client.end();
  }

  const users = await importFromCerbanimo("models/users.js") as { createUserTable: () => Promise<void> };
  const communities = await importFromCerbanimo("models/communities.js") as { createCommunitiesTable: () => Promise<void> };
  const projects = await importFromCerbanimo("models/projects.js") as { createProjectsTable: () => Promise<void> };
  const skills = await importFromCerbanimo("models/skills.js") as { createSkillsTable: () => Promise<void> };
  const resources = await importFromCerbanimo("models/resources.js") as { createResourcesTable: () => Promise<void> };
  const tasks = await importFromCerbanimo("models/tasks.js") as { createTaskTable: () => Promise<void> };
  const impact = await importFromCerbanimo("models/impact_v2.js") as { createImpactTables: () => Promise<void> };
  const kamiyaApi = await importFromCerbanimo("models/kamiya_api.js") as { createKamiyaApiTables: () => Promise<void>; hashApiToken: (token: string) => string };
  const workflows = await importFromCerbanimo("models/workflows.js") as { createWorkflowTables: () => Promise<void> };

  await users.createUserTable();
  await communities.createCommunitiesTable();
  await projects.createProjectsTable();
  await skills.createSkillsTable();
  await resources.createResourcesTable();
  await ensureNeedsPlaceholder();
  await tasks.createTaskTable();
  await ensureBootstrapCompatibilityColumns();
  await impact.createImpactTables();
  await kamiyaApi.createKamiyaApiTables();
  await workflows.createWorkflowTables();
  await ensurePgBossSchema();

  return seedActors(kamiyaApi.hashApiToken);
}

async function ensureNeedsPlaceholder(): Promise<void> {
  await withE2EClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS needs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'open'
      )
    `);
  });
}

async function ensureBootstrapCompatibilityColumns(): Promise<void> {
  await withE2EClient(async (client) => {
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS location JSONB,
        ADD COLUMN IF NOT EXISTS public_good_score NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS public_good_source TEXT,
        ADD COLUMN IF NOT EXISTS service_price INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS service_visibility TEXT[] DEFAULT '{}';

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS resource_requirements TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS impact_depth INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS priority_score NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS decay_factor NUMERIC DEFAULT 1,
        ADD COLUMN IF NOT EXISTS reward_ceiling INTEGER;
    `);
  });
}

async function ensurePgBossSchema(): Promise<void> {
  const moduleUrl = pathToFileURL(path.join(cerbanimoRepoRoot, "backend/jobs/boss.js")).href;
  const { default: boss } = await import(`${moduleUrl}?run=${runId}`);
  await boss.start();
  await boss.createQueue("project-bootstrap").catch(() => {});
  await boss.stop();
}

async function seedActors(hashApiToken: (token: string) => string) {
  const actorA = makeActor("a");
  const actorB = makeActor("b");
  const scopes = [
    "profile:read",
    "projects:read",
    "projects:write",
    "tasks:read",
    "tasks:write",
    "actions:read",
    "actions:write",
    "automation:read",
    "automation:write",
    "ai:route",
    "capabilities:read"
  ];

  await withE2EClient(async (client) => {
    for (const actor of [actorA, actorB]) {
      const user = await client.query(
        `INSERT INTO users (auth0_id, username, email, roles, skills, interests)
         VALUES ($1, $2, $3, '{"user"}'::text[], '[]'::jsonb, '[]'::jsonb)
         RETURNING id`,
        [actor.auth0Id, actor.username, actor.email]
      );
      actor.id = Number(user.rows[0].id);
      await client.query(
        `INSERT INTO api_tokens (user_id, name, token_hash, scopes, client_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, `${actor.displayName} scoped E2E token`, hashApiToken(actor.token), scopes, "kamiya-real-stack-e2e"]
      );
    }
  });

  return { a: actorA, b: actorB };
}

function makeActor(label: "a" | "b") {
  const suffix = runId.slice(-10);
  return {
    id: 0,
    auth0Id: `auth0|${runId}-${label}`,
    username: `e2e_${label}_${suffix}`.slice(0, 50),
    email: `e2e-${label}-${suffix}@example.test`,
    displayName: `E2E Actor ${label.toUpperCase()}`,
    token: `cerb_e2e_${label}_${crypto.randomBytes(24).toString("base64url")}`
  };
}

function startProcesses(): void {
  const commonEnv = {
    ...process.env,
    NODE_ENV: "test",
    POSTGRES_URL: e2eDatabaseUrl,
    DATABASE_URL: e2eDatabaseUrl
  };

  spawnManaged("cerbanimo", process.execPath, [path.join(cerbanimoRepoRoot, "backend/e2e_api_server.js")], {
    cwd: cerbanimoRepoRoot,
    env: {
      ...commonEnv,
      PORT: String(ports.cerbanimoPort),
      BACKEND_URL: `http://127.0.0.1:${ports.cerbanimoPort}`,
      FRONTEND_URL: `http://127.0.0.1:${ports.webPort}`,
      KAMIYA_ALLOWED_ORIGINS: `http://127.0.0.1:${ports.webPort}`,
      GEMINI_API_KEY: "disabled-for-e2e",
      CERBANIMO_E2E_MODE: "true",
      CERBANIMO_PROJECT_BOOTSTRAP_PROVIDER: "deterministic",
      CERBANIMO_QUALITY_CHECK_EXECUTOR: "deterministic",
      CERBANIMO_E2E_PROVIDER_CONTROL_DIR: controlDir
    }
  });

  spawnManaged("kamiya-api", process.execPath, [path.join(rootDir, "node_modules/tsx/dist/cli.mjs"), "server/index.ts"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(ports.apiPort),
      KAMIYA_ALLOWED_ORIGIN: `http://127.0.0.1:${ports.webPort}`,
      KAMIYA_CERBANIMO_API_URL: `http://127.0.0.1:${ports.cerbanimoPort}`,
      KAMIYA_CERBANIMO_TIMEOUT_MS: "10000",
      KAMIYA_REAL_STACK_E2E: "1",
      KAMIYA_AUTOMATION_CONFIRM_POLL_MS: "20000",
      KAMIYA_E2E_NOW: "2026-07-02T12:00:00.000-04:00",
      KAMIYA_DEFAULT_QUALITY_CHECK_REPOSITORY: "glaedn/Kamiya",
      KAMIYA_DEFAULT_QUALITY_CHECK_REF: "main",
      KAMIYA_GEMINI_API_KEY: "",
      GEMINI_API_KEY: ""
    }
  });

  spawnManaged("vite", process.execPath, [path.join(rootDir, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(ports.webPort)], {
    cwd: rootDir,
    env: {
      ...process.env,
      KAMIYA_VITE_PORT: String(ports.webPort),
      KAMIYA_API_PORT: String(ports.apiPort),
      VITE_CERBANIMO_ORIGIN: `http://127.0.0.1:${ports.cerbanimoPort}`,
      VITE_CERBANIMO_API_BASE: `http://127.0.0.1:${ports.cerbanimoPort}`
    }
  });
}

function spawnManaged(name: string, command: string, commandArgs: string[], options: { cwd: string; env: NodeJS.ProcessEnv }): void {
  const logFile = fs.createWriteStream(path.join(artifactDir, `real-stack-${name}.log`), { flags: "w" });
  const child = spawn(command, commandArgs, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const handle = { name, process: child, logFile };
  children.push(handle);

  child.stdout.on("data", (data: Buffer) => writeProcessLog(handle, data));
  child.stderr.on("data", (data: Buffer) => writeProcessLog(handle, data));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[real-stack] ${name} exited unexpectedly code=${code} signal=${signal}`);
      void shutdown(1);
    }
  });
}

function writeProcessLog(child: ChildHandle, data: Buffer): void {
  const text = redactSecrets(data.toString());
  child.logFile.write(text);
  for (const line of text.trimEnd().split(/\r?\n/).filter(Boolean)) {
    console.log(`[${child.name}] ${line}`);
  }
}

async function waitForUrl(url: string, label: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(400);
  }
  throw new Error(`${label} did not become healthy at ${url}: ${lastError}`);
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [...children].reverse()) {
    await killChild(child);
  }

  if (process.env.KAMIYA_REAL_STACK_KEEP_DB !== "1") {
    await dropIsolatedDatabase().catch((error) => {
      console.warn(`[real-stack] database cleanup failed: ${error.message || String(error)}`);
    });
  } else {
    console.log(`[real-stack] preserving isolated database ${e2eDatabaseName}`);
  }

  process.exit(exitCode);
}

async function killChild(child: ChildHandle): Promise<void> {
  child.logFile.end();
  if (child.process.exitCode != null || child.process.killed) return;
  if (process.platform === "win32" && child.process.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.process.pid), "/T", "/F"], { windowsHide: true });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }
  child.process.kill("SIGTERM");
}

async function dropIsolatedDatabase(): Promise<void> {
  assertSafeDatabaseName(e2eDatabaseName);
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(e2eDatabaseName)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

async function withE2EClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: e2eDatabaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function importFromCerbanimo(relativePath: string): Promise<unknown> {
  const url = pathToFileURL(path.join(cerbanimoRepoRoot, relativePath)).href;
  return import(`${url}?run=${runId}`);
}

function resolveCerbanimoRepoRoot(): string {
  const configured = process.env.CERBANIMO_REPO_ROOT;
  const candidates = [
    configured,
    path.resolve(rootDir, "..", "..", "codeprojects/cerbanimo-clone/Cerbanimo"),
    "C:\\Users\\glaed\\codeprojects\\cerbanimo-clone\\Cerbanimo"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "backend/routes/api_v1/index.js"))) {
      return path.resolve(candidate);
    }
  }
  throw new Error("Could not locate Cerbanimo checkout. Set CERBANIMO_REPO_ROOT.");
}

async function gitCommit(cwd: string): Promise<string> {
  const output = await runCapture("git", ["rev-parse", "HEAD"], cwd);
  return output.trim();
}

async function isGitAncestor(ancestor: string, descendant: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd, windowsHide: true });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function runCapture(command: string, commandArgs: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, windowsHide: true });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (data: Buffer) => { output += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
    child.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${commandArgs.join(" ")} failed: ${errorOutput}`));
    });
    child.on("error", reject);
  });
}

function databaseUrlFor(adminUrl: string, databaseName: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function safeDatabaseName(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 54);
  return normalized.includes("e2e") ? normalized : `kamiya_e2e_${normalized}`;
}

function assertSafeDatabaseName(databaseName: string): void {
  if (!/(e2e|test)/i.test(databaseName)) {
    throw new Error(`Refusing database operation on unsafe target "${databaseName}".`);
  }
  if (/(prod|production|live)/i.test(databaseName)) {
    throw new Error(`Refusing database operation on production-like target "${databaseName}".`);
  }
}

function safeDatabaseTarget(value: string): { host: string; database: string } {
  try {
    const url = new URL(value);
    return { host: url.hostname, database: url.pathname.replace(/^\/+/, "") };
  } catch {
    return { host: "", database: "" };
  }
}

function redactDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = "REDACTED";
    return `${url.protocol}//${url.username ? `${url.username}@` : ""}${url.host}${url.pathname}`;
  } catch {
    return "unparseable database url";
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function redactSecrets(value: string): string {
  return value
    .replace(/cerb_[A-Za-z0-9_-]+/g, "cerb_[REDACTED]")
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer [REDACTED]");
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      result[key] = value;
      index += 1;
    } else {
      result[key] = "1";
    }
  }
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
