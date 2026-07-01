import { describe, expect, it } from "vitest";
import { routeIntentLocally } from "./localIntentRouter";

describe("routeIntentLocally", () => {
  it("routes slash commands into the shared command taxonomy", () => {
    const intent = routeIntentLocally("/stats");

    expect(intent.intent).toBe("statistics");
    expect(intent.next_action).toBe("show_stats");
  });

  it("detects task submissions", () => {
    const intent = routeIntentLocally("I finished the landing page and have proof");

    expect(intent.intent).toBe("task_submission");
    expect(intent.next_action).toBe("submit_task");
  });

  it("detects planning requests", () => {
    const intent = routeIntentLocally("Plan a new quest for onboarding volunteers");

    expect(intent.intent).toBe("planning");
    expect(intent.next_action).toBe("ask_missing_inputs");
  });

  it("detects natural create project requests as planning", () => {
    const intent = routeIntentLocally("Create a project for a youth coding club");

    expect(intent.intent).toBe("planning");
    expect(intent.next_action).toBe("ask_missing_inputs");
  });

  it("routes task and profile commands into phase 2 actions", () => {
    expect(routeIntentLocally("/task").next_action).toBe("show_tasks");
    expect(routeIntentLocally("/profile").next_action).toBe("show_profile");
  });

  it("routes automation requests into the phase 3 action queue", () => {
    const intent = routeIntentLocally("/automation create GitHub issues from the plan");

    expect(intent.intent).toBe("automation");
    expect(intent.next_action).toBe("queue_automation");
  });

  it("routes mode commands into phase 4 mode handling", () => {
    const intent = routeIntentLocally("/mode planner");

    expect(intent.intent).toBe("settings");
    expect(intent.next_action).toBe("show_modes");
  });
});
