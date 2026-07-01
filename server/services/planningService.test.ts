import { describe, expect, it } from "vitest";
import { analyzePlanning } from "./planningService";

describe("analyzePlanning", () => {
  it("keeps a planning draft and asks for missing fields without Gemini", async () => {
    const analysis = await analyzePlanning("/plan Launch a neighborhood repair cafe");

    expect(analysis.draft.title).toContain("Launch a neighborhood repair cafe");
    expect(analysis.ready_to_create).toBe(false);
    expect(analysis.missing_fields.length).toBeGreaterThan(0);
    expect(analysis.recommended_next_questions.length).toBeGreaterThan(0);
  });

  it("marks a full draft ready to create", async () => {
    const analysis = await analyzePlanning("Looks good", {
      title: "Repair cafe",
      mission: "Share repair skills locally",
      desiredOutcome: "Residents fix household items together",
      audience: "Neighbors",
      timeline: "Next month",
      successCriteria: "Ten repaired items"
    });

    expect(analysis.ready_to_create).toBe(true);
  });
});
