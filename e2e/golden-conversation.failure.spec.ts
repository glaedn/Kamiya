import { test } from "@playwright/test";

test.describe("golden conversation failure states", () => {
  test.fixme("automatic retry shows retry_wait and recovers after refresh", async () => {});
  test.fixme("blocked invalid graph renders graph-validation failure without project success", async () => {});
  test.fixme("cancel before persistence stops polling and prevents project commit", async () => {});
  test.fixme("network interruption keeps action recoverable and resumes hydration", async () => {});
  test.fixme("double confirmation keeps one action, one workflow, and one project", async () => {});
  test.fixme("expired or absent token asks the user to log in again", async () => {});
});
