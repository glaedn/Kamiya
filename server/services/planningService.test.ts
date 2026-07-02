import { describe, expect, it } from "vitest";
import { analyzePlanning } from "./planningService";

describe("analyzePlanning", () => {
  it("derives a useful draft from a short project idea without Gemini", async () => {
    const analysis = await analyzePlanning("/plan Launch a neighborhood repair cafe");

    expect(analysis.draft.title).toContain("Launch a neighborhood repair cafe");
    expect(analysis.draft.mission).toContain("Launch a neighborhood repair cafe");
    expect(analysis.draft.desiredOutcome).toContain("neighborhood repair cafe");
    expect(analysis.ready_to_create).toBe(true);
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

  it("derives Cerbanimo project fields from a natural community idea", async () => {
    const analysis = await analyzePlanning(
      "/create a local Watertown weekly get together around Magic the Gathering starting in 4 weeks"
    );

    expect(analysis.ready_to_create).toBe(true);
    expect(analysis.draft.title).toBe("Watertown Weekly MtG Meetup");
    expect(analysis.draft.mission).toContain("local Watertown weekly get together");
    expect(analysis.draft.desiredOutcome).toBe("Build a local community around weekly MtG meetups");
    expect(analysis.draft.timeline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
