import { expect, test, type Page } from "@playwright/test";
import { expectPartyQuestBootstrap } from "./real-stack/db";
import { seedRealStackAuth, seedResoneraAuth } from "./real-stack/auth";
import { readRealStackState, scenarioRunId } from "./real-stack/state";
import { acceptSubmittedPartyQuest, settlementReport } from "./real-stack/settlement";
import { goldenMessage } from "./real-stack/browserFlow";

test("a two-person party creates, joins, communicates, submits, and completes one quest", async ({ page, browser }) => {
  const state = readRealStackState();
  const runId = scenarioRunId("party_completion");

  await test.step("the owner creates a one-task quest through Kamiya", async () => {
    await seedRealStackAuth(page, { scenario: "party_completion", runId, actor: "a" });
    await page.goto("/");
    await sendKamiya(page, "Kamiya, can you help me build a plan together?");
    await expect(page.getByText(/What are we hoping to accomplish together\?/)).toBeVisible();
    await expect(page.getByText(/Create project: Kamiya, can you help me build a plan together/i)).toHaveCount(0);
    await sendKamiya(page, goldenMessage);
    await expect(page.getByRole("heading", { name: "Create project: Build a Democratic Digital Economy" })).toBeVisible();
    await page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Create project: Build a Democratic Digital Economy" }) })
      .getByRole("button", { name: "Confirm quest creation" })
      .click();
    await expect(page.getByText("Your quest is live")).toBeVisible({ timeout: 45_000 });
  });

  const quest = await expectPartyQuestBootstrap(runId);

  let inviteUrl = "";
  await test.step("the owner creates a one-use party invite in Kamiya", async () => {
    await sendKamiya(page, `/party invite ${quest.projectId}`);
    const inviteCard = page.locator("article.party_assembly").filter({ hasText: "Party invite created" });
    await expect(inviteCard).toHaveCount(1);
    inviteUrl = await inviteCard.evaluate((card) => {
      const entries = [...card.querySelectorAll(".metadata-grid > div")];
      const invite = entries.find((entry) => entry.querySelector("dt")?.textContent?.trim() === "Invite Url");
      return invite?.querySelector("dd")?.textContent?.trim() || "";
    });
    expect(inviteUrl).toBe(`http://127.0.0.1:${state.resoneraPort}/invite/${inviteUrl.split("/").at(-1)}`);
  });

  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const companionContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerContext.newPage();
  const companion = await companionContext.newPage();
  await seedResoneraAuth(owner, state.actors.a);
  await seedResoneraAuth(companion, state.actors.b);

  try {
    await test.step("a parallel Cerbanimo account accepts in Resonera", async () => {
      await companion.goto(inviteUrl, { waitUntil: "domcontentloaded" });
      await expect(companion.getByText("A quest is calling", { exact: true })).toBeVisible();
      await expect(companion.getByText("Build a Democratic Digital Economy", { exact: true })).toBeVisible();
      await companion.getByRole("button", { name: "Accept and enter the realm" }).click();
      await expect(companion.getByText("Build a Democratic Digital Economy", { exact: true })).toBeVisible({ timeout: 20_000 });

      await owner.goto(`http://127.0.0.1:${state.resoneraPort}/?projectId=${quest.projectId}`, { waitUntil: "domcontentloaded" });
      await expect(owner.getByText("Build a Democratic Digital Economy", { exact: true })).toBeVisible({ timeout: 20_000 });
    });

    await test.step("shared party messages and Kamiya replies appear in both views", async () => {
      await owner.getByRole("button", { name: "Open Kamiya Whisper Console" }).click();
      await companion.getByRole("button", { name: "Open Kamiya Whisper Console" }).click();
      await owner.getByRole("radio", { name: "shared party encounter scope" }).click();
      await companion.getByRole("radio", { name: "shared party encounter scope" }).click();

      const ownerLine = "I will draft the shared goal and completion signal.";
      await sendResonera(owner, ownerLine);
      await expect(companion.getByText(ownerLine, { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(companion.getByText("KAMIYA · SHARED GUIDE", { exact: true })).toBeVisible({ timeout: 20_000 });

      const companionLine = "I will verify the companions’ next steps are clear.";
      await sendResonera(companion, companionLine);
      await expect(owner.getByText(companionLine, { exact: true })).toBeVisible({ timeout: 20_000 });
    });

    await test.step("project lore guides the owner through a real evidence submission", async () => {
      await owner.goto(`http://127.0.0.1:${state.resoneraPort}/threads?projectId=${quest.projectId}`, { waitUntil: "domcontentloaded" });
      await owner.getByRole("button", { name: /Publish the party quest page/ }).click();
      await expect(owner.getByText("THE QUEST THREAD", { exact: true })).toBeVisible();
      await expect(owner.getByText("Signs the council will seek", { exact: true })).toBeVisible();
      await expect(owner.getByText(/shared goal, the companions’ next steps, and a clear completion signal/)).toBeVisible();

      await owner.getByLabel("Evidence summary").fill("Published the one-page party quest guide.");
      await owner.getByLabel("Evidence reflection").fill("The guide names our shared goal, both next steps, and the completion signal we agreed on in the party channel.");
      await owner.getByRole("checkbox").click();
      await owner.getByRole("button", { name: "Present Evidence / Build Preview" }).click();
      await expect(owner.getByText("IRREVERSIBLE ACTION PREVIEW", { exact: true })).toBeVisible({ timeout: 20_000 });
      await owner.getByRole("button", { name: "Confirm Submission" }).click();
      await expect(owner.getByText("The offering is frozen and has entered validation.", { exact: true })).toBeVisible({ timeout: 20_000 });
    });

    const settlementSeed = await acceptSubmittedPartyQuest({
      projectId: quest.projectId,
      taskId: quest.taskId,
      contributorId: state.actors.a.id,
      reviewerId: state.actors.b.id
    });

    await test.step("Kamiya settles the accepted task and both views receive completion", async () => {
      await owner.goto(`http://127.0.0.1:${state.resoneraPort}/whisper?projectId=${quest.projectId}`, { waitUntil: "domcontentloaded" });
      await sendResonera(owner, `preview settlement ${quest.taskId}`);
      await expect(owner.getByText("settlement progress", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await settlementReport(settlementSeed)).projectStatus, { timeout: 30_000 }).toBe("completed");
      await sendResonera(owner, `settlement status ${quest.taskId}`);
      await expect(owner.getByText("Encounter settled", { exact: true })).toBeVisible({ timeout: 20_000 });

      await companion.goto(`http://127.0.0.1:${state.resoneraPort}/threads?projectId=${quest.projectId}`, { waitUntil: "domcontentloaded" });
      await expect(companion.getByText("Harmonized", { exact: true })).toBeVisible({ timeout: 20_000 });
      await companion.getByRole("button", { name: /Publish the party quest page/ }).click();
      await expect(companion.getByText("QUEST COMPLETE", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(companion.getByText("The final thread joins the Chronicle", { exact: true })).toBeVisible();
    });
  } finally {
    await ownerContext.close();
    await companionContext.close();
  }
});

async function sendKamiya(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function sendResonera(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message to Kamiya" }).click();
}
