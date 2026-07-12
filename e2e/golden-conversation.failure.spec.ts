import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { bearerHeaders, seedRealStackAuth } from "./real-stack/auth";
import {
  cerbanimoRequestLog,
  confirmVisiblePreview,
  currentActionId,
  expectNoSeriousAxe,
  goldenMessage,
  installPageErrorCollection,
  resetCerbanimoRequestLog,
  screenshot,
  startGoldenQuest
} from "./real-stack/browserFlow";
import {
  expectBlockedBeforePersistence,
  expectCancelledBeforePersistence,
  expectNoActionsForRun,
  expectRetryThenSuccess,
  expectSuccessfulBootstrap
} from "./real-stack/db";
import { releaseProviderHold, waitForProviderHold } from "./real-stack/providerControl";
import { readRealStackState, scenarioRunId } from "./real-stack/state";

test.describe("golden conversation failure states", () => {
  test("automatic retry shows retry_wait and recovers after refresh", async ({ page }) => {
    const runId = scenarioRunId("timeout_once_then_success");
    const errors = installPageErrorCollection(page);

    await startGoldenQuest(page, "timeout_once_then_success", runId);
    await confirmVisiblePreview(page);
    await expect(page.getByText("retryable problem").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Retrying").first()).toBeVisible();
    await screenshot(page, "real-stack-retrying.png");
    await expectNoSeriousAxe(page);

    const actionId = await currentActionId(page);
    await page.reload();
    await expect.poll(() => currentActionId(page), { timeout: 20_000 }).toBe(actionId);
    await expect(page.getByText(/Quest creation progress|Your quest is live/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });
    const report = await expectRetryThenSuccess(runId);
    expect(report.taskCount).toBe(4);
    expect(errors).toEqual([]);
  });

  test("blocked invalid graph renders graph-validation failure without project success", async ({ page }) => {
    const runId = scenarioRunId("invalid_cycle");
    const errors = installPageErrorCollection(page);

    await startGoldenQuest(page, "invalid_cycle", runId);
    await confirmVisiblePreview(page);
    await expect(page.getByRole("heading", { name: "Quest creation needs attention" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("BOOTSTRAP_GRAPH_INVALID").first()).toBeVisible();
    await expect(page.getByText("validateTaskGraph").first()).toBeVisible();
    await expect(page.getByText("Your quest is live")).not.toBeVisible();
    await screenshot(page, "real-stack-blocked.png");
    await expectNoSeriousAxe(page);

    await expectBlockedBeforePersistence(runId);
    expect(errors).toEqual([]);
  });

  test("cancel before persistence stops polling and prevents project commit", async ({ page }) => {
    const runId = scenarioRunId("hold_before_persist");
    const errors = installPageErrorCollection(page);

    await startGoldenQuest(page, "hold_before_persist", runId);
    await confirmVisiblePreview(page);
    await waitForProviderHold(runId);
    await page.getByRole("button", { name: "Cancel quest creation" }).last().click();
    await expect(page.getByRole("heading", { name: "Quest creation cancelled" })).toBeVisible({ timeout: 20_000 });
    await releaseProviderHold(runId);
    await expect(page.getByText("Quest creation was cancelled before the project was committed.").first()).toBeVisible();
    await screenshot(page, "real-stack-cancelled.png");
    await expectNoSeriousAxe(page);

    await expectCancelledBeforePersistence(runId);
    expect(errors).toEqual([]);
  });

  test("network interruption keeps action recoverable and resumes hydration", async ({ page }) => {
    const runId = scenarioRunId("network_interruption");
    const errors = installPageErrorCollection(page);

    await startGoldenQuest(page, "success_slow", runId);
    await confirmVisiblePreview(page);
    await page.route("**/api/actions/hydrate", (route) => route.abort("failed"));
    await expect(page.getByText("connection to Cerbanimo was interrupted")).toBeVisible({ timeout: 15_000 });
    await page.unroute("**/api/actions/hydrate");
    await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });
    await expectSuccessfulBootstrap(runId);
    expect(errors.filter((error) => !error.includes("Failed to load resource: net::ERR_FAILED"))).toEqual([]);
  });

  test("double confirmation keeps one action, one workflow, and one project", async ({ page, request }) => {
    const runId = scenarioRunId("double_confirmation");
    await resetCerbanimoRequestLog(request);

    await startGoldenQuest(page, "success_slow", runId);
    const button = page.getByRole("button", { name: "Confirm quest creation" }).first();
    await button.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("heading", { name: "Quest creation progress" })).toBeVisible();
    await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });

    const report = await expectSuccessfulBootstrap(runId);
    expect(report.workflowCount).toBe(1);
    const requests = await cerbanimoRequestLog(request);
    const confirmRequests = requests.filter((entry) => entry.method === "POST" && /\/api\/v1\/actions\/[^/]+\/confirm/.test(entry.path));
    expect(confirmRequests).toHaveLength(1);
  });

  test("expired or absent token asks the user to log in again", async ({ page }) => {
    const runId = scenarioRunId("missing_auth");
    await page.addInitScript(({ runId }) => {
      sessionStorage.setItem("kamiya.session", JSON.stringify({
        e2eScenario: "success_slow",
        e2eRunId: runId
      }));
      localStorage.setItem("kamiya.auth", JSON.stringify({
        isLoggedIn: false,
        displayName: "Expired E2E User"
      }));
    }, { runId });

    await page.goto("/");
    await page.getByLabel("Message Kamiya").fill(goldenMessage);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("you are not connected to Cerbanimo").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("cerb_e2e_");
    await expectNoActionsForRun(runId);
  });

  test("cross-user hydration denial does not leak action details", async ({ page, request, browser }) => {
    const state = readRealStackState();
    const runId = scenarioRunId("cross_user_hydration");

    await startGoldenQuest(page, "success_slow", runId);
    await confirmVisiblePreview(page);
    const actionId = await currentActionId(page);
    expect(actionId).toBeTruthy();

    const kamiyaResponse = await request.post("/api/actions/hydrate", {
      data: {
        auth: {
          isLoggedIn: true,
          userId: state.actors.b.auth0Id,
          displayName: state.actors.b.displayName,
          cerbanimoApiUrl: state.cerbanimoApiBase,
          cerbanimoToken: state.actors.b.token,
          permissions: ["projects:create"]
        },
        session: {
          e2eScenario: "success_slow",
          e2eRunId: runId,
          activeAction: {
            actionId,
            actionUuid: actionId,
            functionName: "projects.bootstrap",
            status: "running"
          }
        },
        actionId
      }
    });
    expect(kamiyaResponse.ok()).toBe(true);
    const body = await kamiyaResponse.json() as { message: { content: string } };
    expect(body.message.content).toContain("could not refresh");
    expect(body.message.content).not.toContain("Map governance requirements");

    const cerbanimoResponse = await request.get(`${state.cerbanimoApiBase}/api/v1/actions/${actionId}`, {
      headers: bearerHeaders(state.actors.b)
    });
    expect(cerbanimoResponse.status()).toBe(404);

    const bPage = await browser.newPage();
    await seedRealStackAuth(bPage, {
      scenario: "success_slow",
      runId,
      actor: "b",
      activeAction: {
        actionId,
        actionUuid: actionId,
        functionName: "projects.bootstrap",
        status: "running"
      }
    });
    await bPage.goto("/");
    await expect(bPage.getByText("could not refresh the Cerbanimo action").first()).toBeVisible({ timeout: 15_000 });
    await expect(bPage.locator("body")).not.toContainText("Map governance requirements");
    await bPage.close();

    await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });
    await expectSuccessfulBootstrap(runId);
  });
});

test.afterAll(async () => {
  const state = readRealStackState();
  const summaryPath = path.join(state.artifactDir, "real-stack-summary.json");
  const failureSummary: Record<string, unknown> = {
    profile: "real-stack-failure-matrix",
    generatedAt: new Date().toISOString()
  };
  try {
    const existing = JSON.parse(await fs.readFile(summaryPath, "utf8")) as Record<string, unknown>;
    await fs.writeFile(summaryPath, JSON.stringify({ ...existing, failureMatrix: failureSummary }, null, 2));
  } catch {
    await fs.mkdir(state.artifactDir, { recursive: true });
    await fs.writeFile(summaryPath, JSON.stringify({ failureMatrix: failureSummary }, null, 2));
  }
});
