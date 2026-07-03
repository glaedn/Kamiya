import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { installNetworkGuard } from "./support/networkGuard";
import {
  cerbanimoRequestLog,
  confirmVisiblePreview,
  currentActionId,
  expectNoSeriousAxe,
  installPageErrorCollection,
  resetCerbanimoRequestLog,
  screenshot,
  startGoldenQuest
} from "./real-stack/browserFlow";
import { expectSuccessfulBootstrap } from "./real-stack/db";
import { releaseProviderHold, waitForProviderHold } from "./real-stack/providerControl";
import { readRealStackState, scenarioRunId } from "./real-stack/state";

test.describe("golden conversation real-stack integration", () => {
  test("golden conversation creates a durable quest through real Cerbanimo", async ({ page, request }) => {
    const state = readRealStackState();
    const runId = scenarioRunId("hold_before_persist");
    const networkViolations = installNetworkGuard(page);
    const pageErrors = installPageErrorCollection(page);
    await resetCerbanimoRequestLog(request);

    await test.step("open authenticated Kamiya and preview quest", async () => {
      await startGoldenQuest(page, "hold_before_persist", runId);
      await expect(page.getByText("non-hierarchical collaboration").first()).toBeVisible();
      await expect(page.getByText("democratically governed group constitutions").first()).toBeVisible();
      await screenshot(page, "real-stack-preview.png");
      await expectNoSeriousAxe(page);
    });

    let actionId = "";
    await test.step("confirm and observe real workflow", async () => {
      await confirmVisiblePreview(page);
      actionId = await currentActionId(page);
      expect(actionId).toMatch(/[a-f0-9-]{8,}/i);
      await expect(page.getByText("Designing the project plan").first()).toBeVisible();
      await expect(page.getByText("Mapping the task graph").first()).toBeVisible();
      await waitForProviderHold(runId);
      await screenshot(page, "real-stack-running.png");
    });

    await test.step("refresh while running and rehydrate same action", async () => {
      await page.reload();
      await expect(page.getByText("What is your quest?")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Quest creation progress" })).toBeVisible();
      expect(await currentActionId(page)).toBe(actionId);
      await screenshot(page, "real-stack-recovered-after-refresh.png");
      await releaseProviderHold(runId);
    });

    await test.step("finish and inspect project plus active tasks", async () => {
      await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("heading", { name: "Build a Democratic Digital Economy" })).toBeVisible();
      await expect(page.getByText("Active root tasks")).toBeVisible();
      await expect(page.getByText("Map governance requirements")).toBeVisible();
      await expect(page.getByText("Prototype constitution voting")).toBeVisible();
      await expect(page.getByText("Run baseline repository quality checks")).toBeVisible();
      await expect(page.getByText("Human task").first()).toBeVisible();
      await expect(page.getByText("Automation-assisted").first()).toBeVisible();
      await expect(page.getByText("Automation-ready classification").first()).toBeVisible();
      await expect(page.getByText("github.run_quality_checks").first()).toBeVisible();
      await expect(page.getByText("quality-check-report").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /^Automate$/i })).toHaveCount(0);
      await page.getByRole("button", { name: "Explore active tasks" }).click();
      await expect(page.getByText("Here are the active tasks Cerbanimo says can begin now.")).toBeVisible();
      await expect(page.getByText("Needs 4 inputs: Repository, Target branch, Acceptance criteria, ...").first()).toBeVisible();
      await page.getByRole("button", { name: "View required inputs" }).first().click();
      await expect(page.getByText("Execution is not enabled in this release.").first()).toBeVisible();
      await expect(page.getByText("The behavior the prototype must satisfy before review.").first()).toBeVisible();
      await screenshot(page, "real-stack-completed.png");
      await expectNoSeriousAxe(page);
    });

    const report = await expectSuccessfulBootstrap(runId);
    await writeSummary({
      profile: "real-stack-success",
      runId,
      actionId,
      projectId: report.projectId,
      database: report,
      commits: {
        kamiya: state.kamiyaCommit,
        cerbanimo: state.cerbanimoCommit
      }
    });

    await test.step("network route safety", async () => {
      const cerbanimoRequests = await cerbanimoRequestLog(request);
      const paths = cerbanimoRequests.map((item) => `${item.method} ${item.path}`);
      expect(paths.some((entry) => entry.includes("POST /api/v1/actions/preview"))).toBe(true);
      expect(paths.some((entry) => /POST \/api\/v1\/actions\/[^/]+\/confirm/.test(entry))).toBe(true);
      expect(paths.some((entry) => /GET \/api\/v1\/actions\/[^/]+/.test(entry))).toBe(true);
      expect(paths.some((entry) => entry.includes("/platform"))).toBe(false);
      expect(paths.some((entry) => entry.includes("/projects/create"))).toBe(false);
      expect(paths.some((entry) => entry.includes("/projects/auto-generate"))).toBe(false);
      expect(paths.filter((entry) => /POST \/api\/v1\/actions\/[^/]+\/confirm/.test(entry))).toHaveLength(1);
    });

    await test.step("secret and browser health checks", async () => {
      const localStorageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
      const bodyText = await page.locator("body").innerText();
      expect(localStorageSnapshot).not.toContain("cerb_e2e_");
      expect(bodyText).not.toContain("cerb_e2e_");
      expect(networkViolations).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
});

async function writeSummary(data: Record<string, unknown>): Promise<void> {
  const artifactDir = readRealStackState().artifactDir;
  await fs.mkdir(artifactDir, { recursive: true });
  const filePath = path.join(artifactDir, "real-stack-summary.json");
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    current = {};
  }
  await fs.writeFile(filePath, JSON.stringify({ ...current, integration: data }, null, 2));
}
