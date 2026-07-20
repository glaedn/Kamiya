import { describe, expect, it } from "vitest";
import { normalizeIntent } from "./intentRouter";

describe("normalizeIntent", () => {
  it("routes model-classified statistics to application-owned stats without extra questions", () => {
    const intent = normalizeIntent({
      reasoning: "The user asked for the current realm status.",
      intent: "statistics",
      confidence: 0.91,
      entities: {},
      required_inputs: [{ field: "realm", status: "missing", question: "Which realm?" }],
      next_action: "ask_missing_inputs"
    });

    expect(intent.next_action).toBe("show_stats");
  });

  it("does not rewrite non-statistics workflows", () => {
    const intent = normalizeIntent({
      reasoning: "The user is refining a project.",
      intent: "planning",
      confidence: 0.84,
      entities: {},
      required_inputs: [],
      next_action: "ask_missing_inputs"
    });

    expect(intent.next_action).toBe("ask_missing_inputs");
  });
});
