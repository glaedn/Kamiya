import { beforeEach, describe, expect, it } from "vitest";
import { loadSession, saveSession } from "./storage";

describe("Kamiya session storage", () => {
  beforeEach(() => sessionStorage.clear());

  it("retains safe settlement recovery identifiers", () => {
    saveSession({
      chatId: 4,
      currentSettlementId: "settlement-901",
      currentSettlementTaskId: 901,
      currentQuestProjectId: 100,
      presentationMode: "game_master"
    });

    expect(loadSession()).toMatchObject({
      chatId: 4,
      currentSettlementId: "settlement-901",
      currentSettlementTaskId: 901,
      currentQuestProjectId: 100,
      presentationMode: "game_master"
    });
  });

  it("retains only settlement and task IDs for a settlement confirmation", () => {
    saveSession({
      pendingAction: {
        id: "preview-1",
        kind: "settle_task",
        title: "Complete accepted task",
        summary: "Apply configured consequences.",
        risk: "high",
        destructive: false,
        payload: {
          settlementId: "settlement-901",
          taskId: 901,
          rewardValues: "must-not-persist",
          reviewerNotes: "must-not-persist"
        },
        requiredPermissions: ["tasks:write"],
        createdAt: "2026-07-02T12:00:00.000Z"
      }
    });

    const raw = sessionStorage.getItem("kamiya.session") ?? "";
    expect(loadSession().pendingAction?.payload).toEqual({ settlementId: "settlement-901", taskId: 901 });
    expect(raw).not.toContain("rewardValues");
    expect(raw).not.toContain("reviewerNotes");
  });
});
