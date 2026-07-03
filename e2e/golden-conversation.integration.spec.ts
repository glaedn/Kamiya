import { test } from "@playwright/test";

test.describe("golden conversation real-stack integration", () => {
  test.skip(process.env.KAMIYA_REAL_STACK_E2E !== "1", "Set KAMIYA_REAL_STACK_E2E=1 with an isolated Cerbanimo e2e database and deterministic bootstrap provider.");

  test("real Kamiya web talks to real Cerbanimo /api/v1 project bootstrap", async () => {
    test.fixme(true, "Requires Cerbanimo PR #145 running against a database/schema containing e2e or test, plus a deterministic bootstrap provider flag.");
  });
});
