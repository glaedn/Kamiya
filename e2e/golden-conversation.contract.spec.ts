import { expect, test, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { seedE2EAuth } from "./support/auth";
import { installNetworkGuard } from "./support/networkGuard";

const goldenMessage =
  "Over the next 6 months, I want to create a digital economic system based on anarchic principles, where users can collaborate without fixed hierarchies and democratically decide their group constitutions.";

const screenshotDir = path.resolve("artifacts/golden-conversation");

test.describe("golden conversation contract", () => {
  test("golden conversation creates a durable quest and survives refresh", async ({ page, request }) => {
    await fs.mkdir(screenshotDir, { recursive: true });
    await resetFixture(request);
    const networkViolations = installNetworkGuard(page);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await seedE2EAuth(page);

    await test.step("open Kamiya", async () => {
      await page.goto("/");
      await expect(page.getByText("What is your quest?")).toBeVisible();
      await expect(page.getByLabel("Message Kamiya")).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, "01-logged-in-opening.png") });
    });

    await test.step("describe the quest", async () => {
      await page.getByLabel("Message Kamiya").fill(goldenMessage);
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByText(goldenMessage)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Create project: Build a Democratic Digital Economy" })).toBeVisible();
      await expect(page.getByText("non-hierarchical collaboration").first()).toBeVisible();
      await expect(page.getByText("democratically governed group constitutions").first()).toBeVisible();
      await expect(page.getByText("2027-01-02").first()).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, "02-project-preview.png") });

      const state = await fixtureState(request);
      expect(state.actions).toBe(1);
      expect(state.confirms).toBe(0);
    });

    await test.step("confirm once and observe progress", async () => {
      const confirm = page.getByRole("button", { name: "Confirm quest creation" }).first();
      await confirm.click();
      await expect(page.getByText("Cerbanimo is preparing").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Quest creation progress" })).toBeVisible();
      await expect(page.getByText("Validating your quest").first()).toBeVisible();
      await expect(page.getByText("Designing the project plan").first()).toBeVisible();
      await expect(page.getByText("Mapping the task graph").first()).toBeVisible();
      await expect(page.getByText("Checking dependencies and dates").first()).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, "03-workflow-running.png") });

      const state = await fixtureState(request);
      expect(state.actions).toBe(1);
      expect(state.confirms).toBe(1);
    });

    await test.step("refresh during execution and recover", async () => {
      await page.reload();
      await expect(page.getByText("What is your quest?")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Quest creation progress" })).toBeVisible();
      await expect(page.getByText("Committing the project").first()).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, "04-recovered-after-refresh.png") });

      const state = await fixtureState(request);
      expect(state.actions).toBe(1);
      expect(state.confirms).toBe(1);
    });

    await test.step("complete and inspect active tasks", async () => {
      await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 20_000 });
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
      await expect(page.getByRole("button", { name: "Prepare with Kamiya" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Review quality checks" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open created project" })).toBeVisible();
      await page.getByRole("button", { name: "Explore active tasks" }).click();
      await expect(page.getByText("Here are the active tasks Cerbanimo says can begin now.")).toBeVisible();
      await expect(page.getByText("Needs 4 inputs: Repository, Target branch, Acceptance criteria, ...").first()).toBeVisible();
      await page.getByRole("button", { name: "Prepare with Kamiya" }).first().click();
      await expect(page.getByRole("heading", { name: "Task automation: Prototype constitution voting" })).toBeVisible();
      await expect(page.getByText("CAPABILITY_NOT_REGISTERED").first()).toBeVisible();
      await expect(page.getByText("Approval before external effects.").first()).toBeVisible();
      await page.getByRole("button", { name: "Review quality checks" }).first().click();
      await expect(page.getByText("quality-check action preview").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: /Run quality checks/i })).toBeVisible();
      await page.getByRole("button", { name: "Confirm action" }).first().click();
      await expect(page.getByRole("heading", { name: "Quality checks passed" })).toBeVisible();
      await expect(page.getByText("Build passed.").first()).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, "05-completed-project.png") });

      await page.reload();
      await expect(page.getByText("Human task").first()).toBeVisible();
      await expect(page.getByText("Automation-assisted").first()).toBeVisible();
      await expect(page.getByText("Automation-ready classification").first()).toBeVisible();

      const state = await fixtureState(request);
      expect(state.actions).toBe(2);
      expect(state.confirms).toBe(2);
      expect(state.projects).toBe(1);
    });

    await test.step("security and accessibility checks", async () => {
      const localStorageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
      const domText = await page.locator("body").innerText();
      const currentUrl = page.url();
      expect(localStorageSnapshot).not.toContain("e2e-user-token");
      expect(domText).not.toContain("e2e-user-token");
      expect(currentUrl).not.toContain("e2e-user-token");
      expect(networkViolations).toEqual([]);
      expect(consoleErrors).toEqual([]);

      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
      expect(serious).toEqual([]);
    });
  });
});

async function fixtureState(request: APIRequestContext) {
  const port = process.env.CERBANIMO_E2E_FIXTURE_PORT ?? "4998";
  const response = await request.get(`http://127.0.0.1:${port}/__fixture/state`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ actions: number; confirms: number; projects: number }>;
}

async function resetFixture(request: APIRequestContext) {
  const port = process.env.CERBANIMO_E2E_FIXTURE_PORT ?? "4998";
  const response = await request.post(`http://127.0.0.1:${port}/__fixture/reset`);
  expect(response.ok()).toBe(true);
}
