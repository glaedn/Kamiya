import { expect, test, type Page } from "@playwright/test";
import { seedRealStackAuth } from "./real-stack/auth";
import { readRealStackState, scenarioRunId } from "./real-stack/state";
import { expectCommittedSettlement, seedAcceptedSettlement } from "./real-stack/settlement";
import { bearerHeaders } from "./real-stack/auth";

test("one committed settlement becomes the same world fact in Kamiya and Resonera", async ({ page, browser }) => {
  const seed = await seedAcceptedSettlement();
  await seedRealStackAuth(page, { scenario: "core_world", runId: scenarioRunId("core_world") });
  await page.goto("/");
  await sendKamiya(page, `preview settlement ${seed.taskId}`);
  await expect(page.getByRole("heading", { name: /Applying accepted consequences|Encounter settled/ }).last()).toBeVisible({ timeout: 30_000 });
  const report = await expectCommittedSettlement(seed);

  const state = readRealStackState();
  const contract = await page.request.get(`${state.cerbanimoOrigin}/api/v1/contract`);
  expect(contract.ok()).toBe(true);
  expect(contract.headers()["x-cerbanimo-contract-version"]).toBe("1.0.0");
  expect(contract.headers()["x-cerbanimo-contract-digest"]).toMatch(/^sha256:[a-f0-9]{64}$/);

  const atlasResponse = await page.request.get(`${state.cerbanimoOrigin}/api/v1/me/atlas`, {
    headers: bearerHeaders(state.actors.a)
  });
  const atlasEnvelope = await atlasResponse.json();
  expect(atlasResponse.ok(), JSON.stringify(atlasEnvelope)).toBe(true);
  expect(atlasEnvelope.data.actor).toMatchObject({ id: state.actors.a.id, username: state.actors.a.username });
  expect(atlasEnvelope.data.projects.map((project: { id: number }) => Number(project.id))).toContain(Number(seed.projectId));

  for (const path of [
    `/api/v1/projects/${seed.projectId}/world-state`,
    `/api/v1/tasks/${seed.taskId}/settlement`,
    `/api/v1/tasks/${seed.taskId}/evidence`,
    `/api/v1/events?projectId=${seed.projectId}`
  ]) {
    const denied = await page.request.get(`${state.cerbanimoOrigin}${path}`, { headers: bearerHeaders(state.actors.c) });
    expect(denied.status(), `unrelated actor should be denied ${path}`).toBe(403);
    expect(denied.headers()["x-cerbanimo-contract-digest"]).toBe(contract.headers()["x-cerbanimo-contract-digest"]);
  }

  const eventsResponse = await page.request.get(`${state.cerbanimoOrigin}/api/v1/events?projectId=${seed.projectId}`, {
    headers: bearerHeaders(state.actors.a)
  });
  expect(eventsResponse.ok()).toBe(true);
  const eventEnvelope = await eventsResponse.json();
  expect(eventEnvelope.data.events.map((event: { eventType: string }) => event.eventType)).toEqual(report.eventTypes);
  const replay = await page.request.get(
    `${state.cerbanimoOrigin}/api/v1/events?projectId=${seed.projectId}&after=${eventEnvelope.data.nextCursor}`,
    { headers: bearerHeaders(state.actors.a) }
  );
  expect((await replay.json()).data).toEqual({ events: [], nextCursor: eventEnvelope.data.nextCursor });

  const settlementReplay = await page.request.post(`${state.cerbanimoOrigin}/api/v1/tasks/${seed.taskId}/settlement/preview`, {
    headers: bearerHeaders(state.actors.a),
    data: { sourceClient: "core-world-replay-audit" }
  });
  expect(settlementReplay.ok()).toBe(true);
  expect(await expectCommittedSettlement(seed)).toEqual(report);

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

  await resonera.getByLabel("Close").click();
  await resonera.getByText("Home", { exact: true }).last().click();
  await expect(resonera.getByText(`Settlement Quest ${seed.key}`, { exact: true })).toBeVisible();
  await resonera.route("**/api/v1/projects/*/world-state**", route => route.abort("internetdisconnected"));
  await resonera.reload({ waitUntil: "domcontentloaded" });
  await expect(resonera.getByText("OFFLINE CHRONICLE", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(resonera.getByText(`Settlement Quest ${seed.key}`, { exact: true })).toBeVisible();

  expect(report).toMatchObject({ attemptCount: 1, completions: 1, rewards: 5, xp: 1, outboxDelivered: 4 });
  await resonera.screenshot({ path: `artifacts/golden-conversation/core-world-resonera-${seed.key}.png`, fullPage: true });
  await resonera.close();
});

async function sendKamiya(page: Page, message: string) {
  await page.getByLabel("Message Kamiya").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}
