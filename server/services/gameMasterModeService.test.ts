import { describe, expect, it } from "vitest";
import { parseGameMasterModeCommand } from "./gameMasterModeService";
import { projectQuestNarration } from "./narrativeProjectionService";

describe("Game Master mode services", () => {
  it("parses persistent presentation controls and one-turn plain overrides", () => {
    expect(parseGameMasterModeCommand("/game-master off")).toEqual({ kind: "set_presentation", presentationMode: "plain" });
    expect(parseGameMasterModeCommand("/narrative immersive")).toEqual({ kind: "set_intensity", narrativeIntensity: "immersive" });
    expect(parseGameMasterModeCommand("/stats numeric")).toEqual({ kind: "set_stats", statDisplayMode: "numeric" });
    expect(parseGameMasterModeCommand("Game Master, /quest 100")).toEqual({ kind: "plain_override", strippedMessage: "/quest 100" });
  });

  it("projects quest context without claiming settlement side effects", () => {
    const text = projectQuestNarration({
      project: { id: 100, name: "Be The Bag" },
      questProfile: { title: "Be The Bag", premise: "Make reusable bags visible." },
      party: { members: [{ userId: 1, username: "Glaed" }] },
      tasks: [{ id: 1, name: "Gather bag designs", status: "active-unassigned" }],
      review: { acceptedPendingSettlement: 0 },
      chronicle: []
    }, { presentationMode: "game_master", narrativeIntensity: "standard", statDisplayMode: "both" });

    expect(text).toContain("Be The Bag");
    expect(text).toContain("dependencies are clear");
    expect(text).toContain("Completion settlement");
    expect(text).not.toMatch(/\bawarded?\b/i);
  });
});
