import { expect, test, type Page } from "@playwright/test";
import { seedRealStackAuth } from "./real-stack/auth";
import { expectNoSeriousAxe, installPageErrorCollection, screenshot } from "./real-stack/browserFlow";
import { scenarioRunId } from "./real-stack/state";
import {
  expectCommittedSettlement,
  seedAcceptedSettlement,
  settlementReport
} from "./real-stack/settlement";

test.describe("real-stack completion settlement", () => {
  test("accepted review settles exactly once and hydrates committed facts", async ({ page }) => {
    const seed = await seedAcceptedSettlement();
    const errors = installPageErrorCollection(page);
    await seedRealStackAuth(page, { scenario: "completion_settlement", runId: scenarioRunId("completion_settlement") });
    await page.goto("/");
    await send(page, `preview settlement ${seed.taskId}`);

    await expect(page.getByRole("heading", { name: /Applying accepted consequences|Encounter settled/ }).last()).toBeVisible({ timeout: 20_000 });
    const report = await expectCommittedSettlement(seed);
    await send(page, `settlement status ${seed.taskId}`);
    await expect(page.getByRole("heading", { name: "Encounter settled" }).last()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("1 contributor, 3 counted peer, 1 counted PM reward event(s)").last()).toBeVisible();
    await expect(page.getByText("2 sealed paths have opened.").last()).toBeVisible();
    await expect(page.getByText("Open the verified pilot").last()).toBeVisible();
    await expect(page.getByText("Begin the governance rehearsal").last()).toBeVisible();

    await page.reload();
    await send(page, "/settlement");
    await expect(page.getByRole("heading", { name: "Encounter settled" }).last()).toBeVisible();
    await send(page, "Game Master, show settlement details");
    await expect(page.getByText(/^Out of character:/).last()).toBeVisible();

    await screenshot(page, `real-stack-settlement-${test.info().project.name}.png`);
    await expectNoSeriousAxe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    expect(report.attemptCount).toBe(1);
  });

  test("missing reward policy blocks without completion or victory narration", async ({ page }) => {
    const seed = await seedAcceptedSettlement({ missingRewardPolicy: true });
    await seedRealStackAuth(page, { scenario: "missing_settlement_policy", runId: scenarioRunId("missing_settlement_policy") });
    await page.goto("/");
    await send(page, `preview settlement ${seed.taskId}`);

    await expect(page.getByRole("heading", { name: "Settlement needs attention" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("SETTLEMENT_REWARD_POLICY_MISSING").first()).toBeVisible();
    await expect(page.getByText("The encounter is complete.")).toHaveCount(0);
    const report = await settlementReport(seed);
    expect(report).toMatchObject({ status: "blocked", taskStatus: "submitted", acceptanceStatus: "pending", completions: 0, rewards: 0, xp: 0, completionEvents: 0, outbox: 0, outboxDelivered: 0, activated: 0 });
  });
});

async function send(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}
