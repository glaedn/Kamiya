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

  it("previews project creation once Cerbanimo-required fields are present", async () => {
    const response = await handleChatTurn({
      message:
        "/create project named Neighborhood Garden, description is Build raised beds and organize volunteers, outcome is residents have fresh produce",
      history: [],
      session: {},
      auth: {
        isLoggedIn: true,
        userId: "auth0|user-123",
        displayName: "Glaed",
        permissions: ["projects:create"]
      }
    });

    expect(response.message.content).toContain("Do you want to set a deadline");
    expect(response.session.pendingAction).toBeUndefined();

    const preview = await handleChatTurn({
      message: "no deadline",
      history: [],
      session: response.session,
      auth: {
        isLoggedIn: true,
        userId: "auth0|user-123",
        displayName: "Glaed",
        permissions: ["projects:create"]
      }
    });

    expect(preview.message.content).toContain("Please confirm");
    expect(preview.session.pendingAction?.kind).toBe("create_project");
    expect(preview.session.pendingAction?.payload).toMatchObject({
      name: "Neighborhood Garden",
      description: "Build raised beds and organize volunteers",
      outcomeStatement: "residents have fresh produce"
    });
  });

  it("converts natural language deadline responses into strict Cerbanimo due dates", async () => {
    const auth = {
      isLoggedIn: true,
      userId: "auth0|user-123",
      displayName: "Glaed",
      permissions: ["projects:create"]
    };
    const first = await handleChatTurn({
      message:
        "/create project named Neighborhood Garden, description is Build raised beds and organize volunteers, outcome is residents have fresh produce",
      history: [],
      session: {},
      auth
    });

    const preview = await handleChatTurn({
      message: "next month",
      history: [],
      session: first.session,
      auth
    });

    expect(preview.message.content).toContain("Please confirm");
    expect(preview.session.pendingAction?.payload.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(preview.session.pendingAction?.payload.due_date).toBe(lastDayOfNextMonth());
  });
});

function lastDayOfNextMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
