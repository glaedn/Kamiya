import type { Page } from "@playwright/test";

export function installNetworkGuard(page: Page): string[] {
  const violations: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      violations.push(request.url());
    }
  });
  return violations;
}
