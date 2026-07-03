import type { Page } from "@playwright/test";
import { readRealStackState, type RealStackActor } from "./state";

export async function seedRealStackAuth(page: Page, input: {
  scenario: string;
  runId: string;
  actor?: "a" | "b";
  activeAction?: Record<string, unknown>;
}): Promise<void> {
  const state = readRealStackState();
  const actor = state.actors[input.actor ?? "a"];
  const session = {
    e2eScenario: input.scenario,
    e2eRunId: input.runId,
    e2eControlDir: state.controlDir,
    activeAction: input.activeAction
  };

  await page.addInitScript(({ actor, state, session }) => {
    const bridgeSession = {
      tokenType: "Bearer",
      accessToken: actor.token,
      expiresAt: Date.now() + 60 * 60 * 1000,
      audience: state.cerbanimoApiBase,
      user: {
        sub: actor.auth0Id,
        name: actor.displayName,
        email: actor.email
      }
    };

    sessionStorage.setItem("cerbanimo_auth_bridge", JSON.stringify(bridgeSession));
    sessionStorage.setItem("cerbanimo_access_token", actor.token);
    const existingSession = JSON.parse(sessionStorage.getItem("kamiya.session") || "{}");
    sessionStorage.setItem("kamiya.session", JSON.stringify({
      ...session,
      ...existingSession,
      e2eScenario: session.e2eScenario,
      e2eRunId: session.e2eRunId,
      e2eControlDir: session.e2eControlDir,
      activeAction: existingSession.activeAction ?? session.activeAction
    }));
    localStorage.setItem("kamiya.auth", JSON.stringify({
      isLoggedIn: true,
      userId: actor.auth0Id,
      displayName: actor.displayName,
      permissions: ["projects:create", "actions:write", "actions:read"]
    }));
  }, { actor, state: publicStateForBrowser(state), session });
}

export function bearerHeaders(actor: RealStackActor): Record<string, string> {
  return {
    authorization: `Bearer ${actor.token}`,
    "content-type": "application/json"
  };
}

function publicStateForBrowser(state: ReturnType<typeof readRealStackState>) {
  return {
    cerbanimoApiBase: state.cerbanimoApiBase
  };
}
