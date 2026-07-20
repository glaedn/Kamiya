import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const webPort = Number(process.env.KAMIYA_REAL_STACK_WEB_PORT ?? 5179);
const apiPort = Number(process.env.KAMIYA_REAL_STACK_API_PORT ?? 4181);
const cerbanimoPort = Number(process.env.KAMIYA_REAL_STACK_CERBANIMO_PORT ?? 4401);
const resoneraPort = Number(process.env.KAMIYA_REAL_STACK_RESONERA_PORT ?? 3011);
const baseURL = process.env.KAMIYA_REAL_STACK_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const stateFile = process.env.KAMIYA_REAL_STACK_STATE_FILE ?? path.resolve("node_modules/.cache/kamiya-real-stack/state.json");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalTeardown: "./e2e/real-stack/global-teardown.ts",
  reporter: [["list"], ["html", { outputFolder: "playwright-report-real-stack", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: process.env.KAMIYA_REAL_STACK_SKIP_WEBSERVER
    ? undefined
    : {
        command: [
          "node",
          "./node_modules/tsx/dist/cli.mjs",
          "e2e/real-stack/start-real-stack.ts",
          "--web-port",
          String(webPort),
          "--api-port",
          String(apiPort),
          "--cerbanimo-port",
          String(cerbanimoPort),
          "--resonera-port",
          String(resoneraPort),
          "--state-file",
          stateFile
        ].join(" "),
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 180_000
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } }
    }
  ],
  outputDir: "test-results-real-stack"
});
