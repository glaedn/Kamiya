import { describe, expect, it } from "vitest";
import { handleChatTurn } from "./chatService";

describe("handleChatTurn", () => {
  it("routes /create project into the planning workflow instead of a generic fallback", async () => {
    const response = await handleChatTurn({
      message: "/create project for a youth coding club",
      history: [],
      session: {},
      auth: {
        isLoggedIn: true,
        displayName: "Glaed",
        permissions: ["projects:create"]
      }
    });

    expect(response.message.content).toContain("I can help create that project");
    expect(response.message.content).not.toBe("What is your quest?");
    expect(response.session.planningDraft?.title).toContain("Youth Coding Club");
  });

  it("continues an active planning draft even when the next message is conversational", async () => {
    const auth = {
      isLoggedIn: true,
      displayName: "Glaed",
      permissions: ["projects:create"]
    };
    const first = await handleChatTurn({
      message: "/create project for a youth coding club",
      history: [],
      session: {},
      auth
    });

    const second = await handleChatTurn({
      message:
        "The mission is to help middle school students learn web development, the audience is middle school students, timeline is next month, success means ten students complete a small website",
      history: [],
      session: first.session,
      auth
    });

    expect(second.message.content).toContain("Please confirm");
    expect(second.session.pendingAction?.kind).toBe("create_project");
    expect(second.session.planningDraft?.mission).toContain("help middle school students");
  });
});
