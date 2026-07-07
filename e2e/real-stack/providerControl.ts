import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { readRealStackState } from "./state";

export async function waitForProviderHold(runId: string): Promise<string> {
  const state = readRealStackState();
  const holdPath = path.join(state.controlDir, `${safeId(runId)}.hold`);
  await expect(async () => {
    await fs.access(holdPath);
  }).toPass({ timeout: 15_000 });
  return holdPath;
}

export async function releaseProviderHold(runId: string): Promise<void> {
  const state = readRealStackState();
  await fs.mkdir(state.controlDir, { recursive: true });
  await fs.writeFile(
    path.join(state.controlDir, `${safeId(runId)}.release`),
    JSON.stringify({ runId, releasedAt: new Date().toISOString() })
  );
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
}
