import { afterEach, describe, expect, it, vi } from "vitest";
import { handleChatTurn } from "./chatService";

describe("handleChatTurn", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

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
    mockPreviewFetch();
    const auth = cerbanimoAuth();
    const first = await handleChatTurn({
      message: "/create project for a youth coding club",
      history: [],
      session: {},
      auth,
      channel: "sdk"
    });

    const second = await handleChatTurn({
      message:
        "The mission is to help middle school students learn web development, the audience is middle school students, timeline is next month, success means ten students complete a small website",
      history: [],
      session: first.session,
      auth,
      channel: "sdk"
    });

    expect(second.message.content).toContain("Please review");
    expect(second.session.pendingAction?.kind).toBe("create_project");
    expect(second.session.pendingAction?.cerbanimoActionId).toBe("42");
    expect(second.session.planningDraft?.mission).toContain("help middle school students");
  });

  it("explains that protected previews require login instead of mocking success", async () => {
    const auth = {
      isLoggedIn: true,
      displayName: "Glaed",
      permissions: ["projects:create"]
    };

    const response = await handleChatTurn({
      message:
        "The mission is to help middle school students learn web development, the audience is middle school students, timeline is next month, success means ten students complete a small website",
      history: [],
      session: {
        planningDraft: {
          title: "Youth Coding Club"
        }
      },
      auth
    });

    expect(response.message.content).toContain("cannot prepare the Cerbanimo action preview");
    expect(response.session.pendingAction).toBeUndefined();
  });

  it("previews project creation once Cerbanimo-required fields are present", async () => {
    mockPreviewFetch();
    const auth = cerbanimoAuth();
    const response = await handleChatTurn({
      message:
        "/create project named Neighborhood Garden, description is Build raised beds and organize volunteers, outcome is residents have fresh produce",
      history: [],
      session: {},
      auth,
      channel: "sdk"
    });

    expect(response.message.content).toContain("Do you want to set a deadline");
    expect(response.session.pendingAction).toBeUndefined();

    const preview = await handleChatTurn({
      message: "no deadline",
      history: [],
      session: response.session,
      auth,
      channel: "sdk"
    });

    expect(preview.message.content).toContain("Please review");
    expect(preview.session.pendingAction?.kind).toBe("create_project");
    expect(preview.session.activeAction?.status).toBe("previewed");
    expect(preview.session.pendingAction?.payload).toMatchObject({
      name: "Neighborhood Garden",
      description: "Build raised beds and organize volunteers",
      outcomeStatement: "residents have fresh produce"
    });
  });

  it("keeps generated Cerbanimo project names within the live database limit", async () => {
    mockPreviewFetch();
    const response = await handleChatTurn({
      message:
        "/create project named " +
        "A".repeat(160) +
        ", description is Build a focused local initiative, outcome is the local initiative is operating",
      history: [],
      session: { planningDeadlinePrompted: true },
      auth: cerbanimoAuth(),
      channel: "sdk"
    });

    expect(String(response.session.pendingAction?.payload.name)).toHaveLength(100);
  });

  it("converts natural language deadline responses into strict Cerbanimo due dates", async () => {
    mockPreviewFetch();
    const auth = cerbanimoAuth();
    const first = await handleChatTurn({
      message:
        "/create project named Neighborhood Garden, description is Build raised beds and organize volunteers, outcome is residents have fresh produce",
      history: [],
      session: {},
      auth,
      channel: "sdk"
    });

    const preview = await handleChatTurn({
      message: "next month",
      history: [],
      session: first.session,
      auth,
      channel: "sdk"
    });

    expect(preview.message.content).toContain("Please review");
    expect(preview.session.pendingAction?.payload.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(preview.session.pendingAction?.payload.dueDate).toBe(lastDayOfNextMonth());
  });

  it("summarizes the created project and active tasks after confirmation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "x-request-id": "req-preview" }),
        json: async () => ({
          ok: true,
          data: actionRow("previewed"),
          error: null,
          requestId: "req-preview"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Headers({ "x-request-id": "req-confirm" }),
        json: async () => ({ ok: true, data: actionRow("confirmed"), error: null, requestId: "req-confirm" })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "x-request-id": "req-detail" }),
        json: async () => ({ ok: true, data: completedDetail(), error: null, requestId: "req-detail" })
      });
    vi.stubGlobal("fetch", fetchMock);

    const preview = await handleChatTurn({
      message:
        "/create a local Watertown weekly get together around Magic the Gathering starting in 4 weeks",
      history: [],
      session: {},
      auth: {
        isLoggedIn: true,
        userId: "auth0|user-123",
        cerbanimoApiUrl: "http://localhost:4000",
        cerbanimoToken: "token",
        permissions: ["projects:create"]
      },
      channel: "sdk"
    });

    const response = await handleChatTurn({
      message: "confirm",
      history: [],
      session: preview.session,
      auth: {
        isLoggedIn: true,
        userId: "auth0|user-123",
        cerbanimoApiUrl: "http://localhost:4000",
        cerbanimoToken: "token",
        permissions: ["projects:create"]
      },
      channel: "sdk"
    });

    expect(response.message.content).toContain("Your quest is live");
    expect(JSON.stringify(response.message.cards)).toContain("Watertown Weekly MtG Meetup");
    expect(response.message.cards?.some((card) => card.title.includes("Active root tasks"))).toBe(true);
    expect(JSON.stringify(response.message.cards)).toContain("Reserve a table");
    expect(JSON.stringify(response.message.cards)).toContain("Human task");
    expect(JSON.stringify(response.message.cards)).not.toContain('"label":"Automate"');
  });

  it("previews and confirms a prepared quality-check automation", async () => {
    process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REPOSITORY = "glaedn/Kamiya";
    process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REF = "main";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: taskAutomationContext({ preparation: { id: 5, status: "ready", capability_name: "github.run_quality_checks" } }),
        error: null,
        requestId: "req-prep"
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: taskAutomationContext({ action: automationActionRow({ id: 77, action_uuid: "automation-action-77", status: "previewed" }) }),
        error: null,
        requestId: "req-preview"
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: automationActionRow({ id: 77, action_uuid: "automation-action-77", status: "confirmed", related_automation_run_id: 88 }),
        error: null,
        requestId: "req-confirm"
      }, 202))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: automationRunRow(),
        error: null,
        requestId: "req-run"
      }));
    vi.stubGlobal("fetch", fetchMock);

    const auth = cerbanimoAuth();
    const preview = await handleChatTurn({
      message: "review quality checks 203",
      history: [],
      session: {},
      auth,
      channel: "sdk"
    });

    expect(preview.message.content).toContain("quality-check action preview");
    expect(preview.session.pendingAction?.kind).toBe("run_automation");
    expect(preview.session.pendingAction?.cerbanimoActionId).toBe("77");

    const confirmed = await handleChatTurn({
      message: "confirm",
      history: [],
      session: preview.session,
      auth,
      channel: "sdk"
    });

    expect(confirmed.message.content).toContain("returned the report");
    expect(JSON.stringify(confirmed.message.cards)).toContain("Quality checks passed");
    expect(JSON.stringify(confirmed.message.cards)).toContain("Build passed");
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "http://localhost:4000/api/v1/tasks/203/automation/preparations",
      "http://localhost:4000/api/v1/tasks/203/automation/preparations/5/preview",
      "http://localhost:4000/api/v1/actions/automation-action-77/confirm",
      "http://localhost:4000/api/v1/automation/runs/88"
    ]);
  });
});

function cerbanimoAuth() {
  return {
    isLoggedIn: true,
    userId: "auth0|user-123",
    displayName: "Glaed",
    cerbanimoApiUrl: "http://localhost:4000",
    cerbanimoToken: "token",
    permissions: ["projects:create", "actions:write", "actions:read"]
  };
}

function mockPreviewFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "x-request-id": "req-preview" }),
      json: async () => ({
        ok: true,
        data: actionRow("previewed"),
        error: null,
        requestId: "req-preview"
      })
    })
  );
}

function actionRow(status: string) {
  return {
    id: 42,
    action_uuid: "action-uuid-42",
    status,
    risk_level: "low",
    intent_json: { functionName: "projects.bootstrap" },
    preview_payload: {},
    execution_result: null,
    related_project_id: status === "executed" ? 100 : null,
    created_at: "2026-07-02T12:00:00.000Z"
  };
}

function automationActionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    action_uuid: "automation-action-77",
    status: "previewed",
    risk_level: "normal",
    intent_json: { functionName: "tasks.run_automation" },
    preview_payload: {
      title: "Run quality checks for Run baseline repository quality checks",
      summary: "Cerbanimo will run quality checks after confirmation."
    },
    execution_result: null,
    related_project_id: null,
    related_task_id: 203,
    created_at: "2026-07-02T12:00:00.000Z",
    ...overrides
  };
}

function completedDetail() {
  return {
    action: actionRow("executed"),
    workflow: {
      id: "wf-1",
      status: "completed",
      workflow_type: "projects.bootstrap",
      action_id: 42,
      related_project_id: 100,
      attempt_count: 1
    },
    steps: [
      "validateInput",
      "generateProjectPlan",
      "generateTaskGraph",
      "validateTaskGraph",
      "persistProjectGraph",
      "activateRootTasks",
      "finalizeAction"
    ].map((step_name, id) => ({ id, step_name, status: "completed" })),
    project: {
      id: 100,
      name: "Watertown Weekly MtG Meetup",
      description: "Create a local Watertown weekly get together",
      due_date: "2026-08-01"
    },
    tasks: [
      {
        id: 1,
        name: "Reserve a table",
        description: "Find a venue.",
        status: "active",
        reward_tokens: 10,
        skill_name: "Coordination",
        skill_level: 1,
        dependencies: [],
        automation: {
          classification: "human_driven",
          confidenceBand: "high",
          rationale: "This task requires a person to coordinate with a local venue.",
          requiredHumanInputs: [],
          requirements: {},
          validationRequirements: [],
          source: "generated",
          findings: []
        }
      }
    ],
    activeTasks: [
      {
        id: 1,
        name: "Reserve a table",
        description: "Find a venue.",
        status: "active",
        reward_tokens: 10,
        skill_name: "Coordination",
        skill_level: 1,
        dependencies: [],
        automation: {
          classification: "human_driven",
          confidenceBand: "high",
          rationale: "This task requires a person to coordinate with a local venue.",
          requiredHumanInputs: [],
          requirements: {},
          validationRequirements: [],
          source: "generated",
          findings: []
        }
      }
    ],
    terminal: true,
    result: null,
    error: null
  };
}

function taskAutomationContext(overrides: Record<string, unknown> = {}) {
  return {
    task: {
      id: 203,
      name: "Run baseline repository quality checks",
      status: "active-unassigned",
      automation: qualityAutomation()
    },
    automation: qualityAutomation(),
    inputSchema: [
      { key: "repository", label: "Repository", inputType: "repository", required: true, sensitive: false },
      { key: "ref", label: "Ref", inputType: "text", required: true, sensitive: false },
      { key: "checkProfile", label: "Check profile", inputType: "choice", required: true, sensitive: false },
      { key: "approval", label: "Approval", inputType: "approval", required: true, sensitive: false }
    ],
    preparation: { id: 5, status: "ready", capability_name: "github.run_quality_checks" },
    validation: { valid: true, errors: [], findings: [] },
    capability: {
      requiredCapabilities: ["github.run_quality_checks"],
      availableCapabilities: ["github.run_quality_checks"],
      missingCapabilities: [],
      actorAuthorized: true,
      executionAvailable: true,
      templateKey: "run_quality_checks",
      executor: "deterministic",
      reasons: []
    },
    ...overrides
  };
}

function qualityAutomation() {
  return {
    classification: "fully_automatable",
    confidenceBand: "high",
    rationale: "Bounded digital verification.",
    requiredHumanInputs: [],
    requirements: { capabilities: ["github.run_quality_checks"], expectedArtifacts: ["quality-check-report"] },
    validationRequirements: [],
    source: "generated",
    findings: []
  };
}

function automationRunRow() {
  return {
    id: 88,
    run_uuid: "automation-run-88",
    status: "completed",
    template_key: "run_quality_checks",
    result: {
      status: "checks_passed",
      summary: "Quality checks passed.",
      submittedTask: true,
      checks: [{ key: "build", status: "passed", message: "Build passed." }]
    },
    logs: []
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Bad Request",
    headers: new Headers({ "x-request-id": (body as { requestId?: string }).requestId ?? "req-test" }),
    json: async () => body
  };
}

function lastDayOfNextMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
