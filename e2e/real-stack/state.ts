import fs from "node:fs";
import path from "node:path";

export interface RealStackActor {
  id: number;
  auth0Id: string;
  username: string;
  email: string;
  displayName: string;
  token: string;
}

export interface RealStackState {
  runId: string;
  createdAt: string;
  stateFile: string;
  artifactDir: string;
  controlDir: string;
  cerbanimoRepoRoot: string;
  resoneraRepoRoot: string;
  cerbanimoCommit: string;
  kamiyaCommit: string;
  webPort: number;
  apiPort: number;
  cerbanimoPort: number;
  resoneraPort: number;
  cerbanimoOrigin: string;
  cerbanimoApiBase: string;
  database: {
    url: string;
    host: string;
    name: string;
  };
  actors: {
    a: RealStackActor;
    b: RealStackActor;
    c: RealStackActor;
  };
}

export function realStackStatePath(): string {
  return process.env.KAMIYA_REAL_STACK_STATE_FILE ?? path.resolve("node_modules/.cache/kamiya-real-stack/state.json");
}

export function readRealStackState(): RealStackState {
  const stateFile = realStackStatePath();
  return JSON.parse(fs.readFileSync(stateFile, "utf8")) as RealStackState;
}

export function scenarioRunId(scenario: string, suffix = crypto.randomUUID().slice(0, 8)): string {
  const safeScenario = scenario.replace(/[^a-z0-9_-]/gi, "_").slice(0, 36);
  return `${readRealStackState().runId}_${safeScenario}_${suffix}`;
}
