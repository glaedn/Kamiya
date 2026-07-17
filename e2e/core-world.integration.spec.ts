import { expect, test, type Page } from "@playwright/test";
import { seedRealStackAuth } from "./real-stack/auth";
import { readRealStackState, scenarioRunId } from "./real-stack/state";
import { expectCommittedSettlement, seedAcceptedSettlement } from "./real-stack/settlement";

test("one committed settlement becomes the same world fact in Kamiya and Resonera", async ({ page, browser }) => {
  const seed = await seedAcceptedSettlement();
  await seedRealStackAuth(page, { scenario: "core_world", runId: scenarioRunId("core_world") });
  await page.goto("/");
  await sendKamiya(page, `preview settlement ${seed.taskId}`);
  await expect(page.getByRole("heading", { name: /Applying accepted consequences|Encounter settled/ }).last()).toBeVisible({ timeout: 30_000 });
  const report = await expectCommittedSettlement(seed);

  const state = readRealStackState();
  const resonera = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await resonera.goto(`http://127.0.0.1:${state.resoneraPort}/?projectId=${seed.projectId}`, { waitUntil: "domcontentloaded" });
  await expect(resonera.getByText(`Settlement Quest ${seed.key}`, { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(resonera.getByText("40", { exact: true }).first()).toBeVisible();
  await resonera.getByText("Threads", { exact: true }).last().click();
  await expect(resonera.getByText("Ship the accepted settlement slice", { exact: true })).toBeVisible();
  await expect(resonera.getByText("Harmonized", { exact: true }).first()).toBeVisible();
  await expect(resonera.getByText("Open the verified pilot", { exact: true }).last()).toBeVisible();
  await expect(resonera.getByText("Begin the governance rehearsal", { exact: true }).last()).toBeVisible();

  await resonera.getByRole("button", { name: "Open Kamiya Whisper Console" }).click();
  await resonera.getByLabel("Message Kamiya").fill(`settlement status ${seed.taskId}`);
  await resonera.getByLabel("Send").click();
  await expect(resonera.getByText("Encounter settled", { exact: true }).last()).toBeVisible({ timeout: 20_000 });

  expect(report).toMatchObject({ attemptCount: 1, completions: 1, rewards: 5, xp: 1, outboxDelivered: 4 });
  await resonera.screenshot({ path: `artifacts/golden-conversation/core-world-resonera-${seed.key}.png`, fullPage: true });
  await resonera.close();
});

async function sendKamiya(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}
