import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPreview } from "../../shared/types";
import { CerbanimoClient } from "./cerbanimoClient";

describe("CerbanimoClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates projects through Cerbanimo's project creation endpoint with the Auth0 user id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42, name: "Neighborhood Garden" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, tasks: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });
    vi.stubGlobal("fetch", fetchMock);

    const action: ActionPreview = {
      id: "preview-1",
      kind: "create_project",
      title: "Create project: Neighborhood Garden",
      summary: "Create project",
      risk: "low",
      destructive: false,
      requiredPermissions: ["projects:create"],
      createdAt: new Date().toISOString(),
      payload: {
        name: "Neighborhood Garden",
        description: "Build raised beds and organize volunteers",
        outcomeStatement: "Residents have fresh produce",
        tags: [],
        autoGeneratePlan: true
      }
    };

    const result = await new CerbanimoClient({
      isLoggedIn: true,
      userId: "auth0|user-123",
      cerbanimoApiUrl: "http://localhost:4000",
      cerbanimoToken: "token"
    }).executeAction(action);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/projects/create",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"auth0_id":"auth0|user-123"')
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/projects/auto-generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ projectId: 42 })
      })
    );
  });

  it("returns active tasks when Cerbanimo wraps project task results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42, name: "Watertown Weekly MtG Meetup" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            { id: 1, name: "Reserve a table", status: "active" },
            { id: 2, name: "Publish recap", status: "blocked" }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const action: ActionPreview = {
      id: "preview-1",
      kind: "create_project",
      title: "Create project: Watertown Weekly MtG Meetup",
      summary: "Create project",
      risk: "low",
      destructive: false,
      requiredPermissions: ["projects:create"],
      createdAt: new Date().toISOString(),
      payload: {
        name: "Watertown Weekly MtG Meetup",
        description: "Create a local Watertown weekly get together",
        outcomeStatement: "Build a local community around weekly MtG meetups",
        tags: [],
        autoGeneratePlan: true
      }
    };

    const result = await new CerbanimoClient({
      isLoggedIn: true,
      userId: "auth0|user-123",
      cerbanimoApiUrl: "http://localhost:4000",
      cerbanimoToken: "token"
    }).executeAction(action);

    expect(result.ok).toBe(true);
    expect((result.data as { activeTasks: unknown[] }).activeTasks).toHaveLength(1);
  });
});
