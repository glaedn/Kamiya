import { expect, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { seedRealStackAuth } from "./auth";
import { readRealStackState } from "./state";

export const goldenMessage =
  "Over the next 6 months, I want to create a digital economic system based on anarchic principles, where users can collaborate without fixed hierarchies and democratically decide their group constitutions.";

export async function startGoldenQuest(page: Page, scenario: string, runId: string): Promise<void> {
  await seedRealStackAuth(page, { scenario, runId });
  await page.goto("/");
  await expect(page.getByText("What is your quest?")).toBeVisible();
  await page.getByLabel("Message Kamiya").fill(goldenMessage);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Create project: Build a Democratic Digital Economy" })).toBeVisible();
  await expect(page.getByText("2027-01-02").first()).toBeVisible();
}

export async function confirmVisiblePreview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Confirm quest creation" }).first().click();
  await expect(page.getByRole("heading", { name: "Quest creation progress" })).toBeVisible();
}

export async function currentActionId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("kamiya.session") || "{}") as {
      activeAction?: { actionUuid?: string; actionId?: string };
    };
    return session.activeAction?.actionUuid ?? session.activeAction?.actionId ?? "";
  });
}

export async function expectNoSeriousAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(serious).toEqual([]);
}

export async function screenshot(page: Page, name: string): Promise<string> {
  const state = readRealStackState();
  await fs.mkdir(state.artifactDir, { recursive: true });
  const filePath = path.join(state.artifactDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function resetCerbanimoRequestLog(request: APIRequestContext): Promise<void> {
  const state = readRealStackState();
  const response = await request.post(`${state.cerbanimoOrigin}/__e2e/requests/reset`);
  expect(response.ok()).toBe(true);
}

export async function cerbanimoRequestLog(request: APIRequestContext): Promise<Array<{ method: string; path: string }>> {
  const state = readRealStackState();
  const response = await request.get(`${state.cerbanimoOrigin}/__e2e/requests`);
  expect(response.ok()).toBe(true);
  const body = await response.json() as { requests: Array<{ method: string; path: string }> };
  return body.requests;
}

export function installPageErrorCollection(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
