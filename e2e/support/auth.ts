import type { Page } from "@playwright/test";

export async function seedE2EAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const session = {
      tokenType: "Bearer",
      accessToken: "e2e-user-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      audience: "http://127.0.0.1:4998",
      user: {
        sub: "auth0|e2e-user",
        name: "E2E User",
        email: "e2e@example.test"
      }
    };
    sessionStorage.setItem("cerbanimo_auth_bridge", JSON.stringify(session));
    sessionStorage.setItem("cerbanimo_access_token", session.accessToken);
    localStorage.setItem("kamiya.auth", JSON.stringify({
      isLoggedIn: true,
      userId: "auth0|e2e-user",
      displayName: "E2E User",
      permissions: ["projects:create", "actions:write", "actions:read"]
    }));
  });
}
