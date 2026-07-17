import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedE2EAuth } from "./support/auth";
import { installNetworkGuard } from "./support/networkGuard";

test.describe("completion settlement contract", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetFixture(request);
    await seedE2EAuth(page);
    await page.goto("/");
    await expect(page.getByText("What is your quest?")).toBeVisible();
  });

  test("hydrates committed facts, survives refresh, and supports one-turn plain mode", async ({ page }) => {
    const violations = installNetworkGuard(page);

    await send(page, "settlement status 901");
    await expect(page.getByRole("heading", { name: "Applying accepted consequences" })).toBeVisible();
    await expect(page.getByText("The review is accepted. Cerbanimo is applying completion, rewards, progression, and newly unlocked work.").last()).toBeVisible();
    await expect(page.getByText("Ledger rewards")).toHaveCount(0);

    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(page.getByRole("heading", { name: "Encounter settled" }).last()).toBeVisible();
    await expect(page.getByText("The encounter is complete.").last()).toBeVisible();
    await expect(page.getByText("2 sealed paths have opened.").last()).toBeVisible();
    await expect(page.getByText("A calling advanced from level 2 to level 3.").last()).toBeVisible();
    await expect(page.getByText("1 contributor, 3 counted peer, 1 counted PM reward event(s)").last()).toBeVisible();
    await expect(page.getByText("Invite pilot participants").last()).toBeVisible();

    await page.reload();
    await send(page, "/settlement");
    await expect(page.getByRole("heading", { name: "Encounter settled" }).last()).toBeVisible();

    await send(page, "Game Master, show settlement details");
    await expect(page.getByText(/Out of character: Cerbanimo committed task completion/).last()).toBeVisible();
    await expect(page.getByText(/Out of character: task 901 completed at/).last()).toBeVisible();

    const plainCount = await page.getByText(/Out of character:/).count();
    await send(page, "settlement status 902");
    await expect(page.getByText("The encounter is complete.").last()).toBeVisible();
    await expect(page.getByText(/Out of character:/)).toHaveCount(plainCount);
    expect(violations).toEqual([]);
  });

  test("shows safe blocked and retry states without victory overclaim", async ({ page, request }) => {
    await send(page, "settlement status 903");
    await expect(page.getByRole("heading", { name: "Settlement needs attention" })).toBeVisible();
    await expect(page.getByText("Review remains accepted")).toBeVisible();
    await expect(page.getByText("The contributor reward amount is not configured.")).toBeVisible();
    await expect(page.getByText("The encounter is complete.")).toHaveCount(0);
    await expect(page.getByText("Ledger rewards")).toHaveCount(0);

    await send(page, "settlement status 904");
    await expect(page.getByRole("button", { name: "Retry settlement" })).toBeVisible();
    await page.getByRole("button", { name: "Retry settlement" }).click();
    await expect(page.getByRole("heading", { name: "Applying accepted consequences" }).last()).toBeVisible();
    await page.getByRole("button", { name: "Refresh status" }).last().click();
    await expect(page.getByRole("heading", { name: "Encounter settled" }).last()).toBeVisible();

    const state = await fixtureState(request);
    expect(state.settlementRetries).toBe(1);
  });

  test("narrates project completion only from the committed project fact", async ({ page }) => {
    await send(page, "settlement status 905");
    await expect(page.getByText("Every required encounter is complete; the Quest Chronicle is ready for its epilogue.")).toBeVisible();
    await expect(page.getByText("Every required task is complete.")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Chronicle" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

async function send(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function resetFixture(request: APIRequestContext) {
  const port = process.env.CERBANIMO_E2E_FIXTURE_PORT ?? "4998";
  const response = await request.post(`http://127.0.0.1:${port}/__fixture/reset`);
  expect(response.ok()).toBe(true);
}

async function fixtureState(request: APIRequestContext) {
  const port = process.env.CERBANIMO_E2E_FIXTURE_PORT ?? "4998";
  const response = await request.get(`http://127.0.0.1:${port}/__fixture/state`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ settlementReads: number; settlementRetries: number }>;
}
