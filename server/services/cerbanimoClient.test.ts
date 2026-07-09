import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPreview } from "../../shared/types";
import { CerbanimoClient } from "./cerbanimoClient";

const auth = {
  isLoggedIn: true,
  userId: "auth0|user-123",
  cerbanimoApiUrl: "http://localhost:4000",
  cerbanimoToken: "user-token",
  permissions: ["projects:create", "actions:write", "actions:read"]
};

describe("CerbanimoClient /api/v1 action contract", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("persists a projects.bootstrap preview through /api/v1/actions/preview", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: actionRow({ id: 42, action_uuid: "action-uuid-42", status: "previewed" }),
      requestId: "req-preview"
    });

    const result = await new CerbanimoClient(auth).previewProjectBootstrap(projectAction());

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("req-preview");
    expect(result.data?.preview.cerbanimoActionId).toBe("42");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/actions/preview",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"functionName":"projects.bootstrap"')
      })
    );
  });

  it("confirms an action and preserves 202 request IDs", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: actionRow({ id: 42, status: "confirmed" }),
      requestId: "req-confirm"
    }, 202);

    const result = await new CerbanimoClient(auth).confirmAction("action-uuid-42");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.requestId).toBe("req-confirm");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/actions/action-uuid-42/confirm");
  });

  it("hydrates action detail with workflow, project, and active tasks", async () => {
    mockFetch({
      ok: true,
      data: actionDetail({ workflowStatus: "completed", actionStatus: "executed" }),
      requestId: "req-detail"
    });

    const result = await new CerbanimoClient(auth).getActionDetail("42");

    expect(result.ok).toBe(true);
    expect(result.data?.workflow?.status).toBe("completed");
    expect(result.data?.project?.name).toBe("Build a Democratic Digital Economy");
    expect(result.data?.activeTasks).toHaveLength(1);
    expect(result.data?.activeTasks[0].automation?.classification).toBe("human_driven");
    expect(result.data?.activeTasks[0].automation?.source).toBe("legacy_default");
    expect(result.requestId).toBe("req-detail");
  });

  it("parses canonical task automation metadata without upgrading malformed data", async () => {
    mockFetch({
      ok: true,
      data: actionDetail({
        workflowStatus: "completed",
        actionStatus: "executed",
        activeTasks: [
          {
            id: 201,
            name: "Prototype constitution voting",
            status: "active-unassigned",
            automation: {
              classification: "assisted_automation",
              requiredHumanInputs: [{ key: "repository", label: "Repository", inputType: "repository" }],
              requirements: { capabilities: ["github.generate_pull_request"] },
              validationRequirements: [],
              source: "generated"
            }
          },
          {
            id: 202,
            name: "Legacy malformed task",
            status: "active-unassigned",
            automation: {
              classification: "magic_robot",
              requiredHumanInputs: "not an array",
              requirements: "not an object"
            }
          }
        ]
      }),
      requestId: "req-detail"
    });

    const result = await new CerbanimoClient(auth).getActionDetail("42");

    expect(result.ok).toBe(true);
    expect(result.data?.activeTasks[0].automation?.classification).toBe("assisted_automation");
    expect(result.data?.activeTasks[0].automation?.requiredHumanInputs).toHaveLength(1);
    expect(result.data?.activeTasks[1].automation?.classification).toBe("human_driven");
    expect(result.data?.activeTasks[1].automation?.requiredHumanInputs).toEqual([]);
  });

  it("supports retry and cancel action mutations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: actionRow({ id: 42, status: "confirmed" }), error: null, requestId: "req-retry" }, 202))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: actionRow({ id: 42, status: "cancelled" }), error: null, requestId: "req-cancel" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CerbanimoClient(auth);
    const retry = await client.retryAction("42");
    const cancel = await client.cancelAction("42");

    expect(retry.ok).toBe(true);
    expect(cancel.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/actions/42/retry");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/actions/42/cancel");
  });

  it("previews prepared task automation through the task automation API", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: taskAutomationContext({ action: actionRow({ id: 77, action_uuid: "automation-action-77", status: "previewed" }) }),
      requestId: "req-automation-preview"
    }, 201);

    const result = await new CerbanimoClient(auth).previewTaskAutomationPreparation(203, 5);

    expect(result.ok).toBe(true);
    expect(result.data?.action?.id).toBe(77);
    expect(result.data?.capability.executionAvailable).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/tasks/203/automation/preparations/5/preview");
  });

  it("confirms prepared task automation and hydrates the automation run", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: actionRow({ id: 77, action_uuid: "automation-action-77", status: "confirmed", related_automation_run_id: 88 }),
        error: null,
        requestId: "req-confirm-automation"
      }, 202))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: automationRunRow(),
        error: null,
        requestId: "req-run"
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CerbanimoClient(auth).executeAction({
      id: "local-automation-preview",
      kind: "run_automation",
      title: "Run quality checks",
      summary: "Run checks after confirmation.",
      risk: "medium",
      destructive: false,
      payload: { taskId: 203, preparationId: 5 },
      requiredPermissions: ["automation:write"],
      createdAt: "2026-07-02T12:00:00.000Z",
      cerbanimoActionId: "77",
      cerbanimoActionUuid: "automation-action-77"
    });

    expect(result.ok).toBe(true);
    expect((result.data as { automationRun?: { result?: { status?: string } } }).automationRun?.result?.status).toBe("checks_passed");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/actions/automation-action-77/confirm");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/automation/runs/88");
  });

  it("loads task evidence through the v1 evidence endpoint", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: {
        ...taskEvidenceContext(),
        requirements: [{
          requirementId: "proof",
          description: "Show the work was completed.",
          acceptedEvidenceTypes: ["text"],
          checks: ["evidence_present"],
          semanticReview: "never"
        }]
      },
      error: null,
      requestId: "req-evidence"
    });

    const result = await new CerbanimoClient(auth).taskEvidence(203);

    expect(result.ok).toBe(true);
    expect(result.data?.requirements?.[0].requirementId).toBe("proof");
    expect(result.data?.requirements?.[0].semanticReview).toBe("never");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/tasks/203/evidence");
  });

  it("supports evidence cancellation and superseding draft routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: taskEvidenceContext(), error: null, requestId: "req-cancel" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: taskEvidenceContext(), error: null, requestId: "req-supersede" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CerbanimoClient(auth);
    const cancel = await client.cancelEvidenceBundle(203, "bundle-501");
    const supersede = await client.supersedeEvidenceBundle(203, "bundle-501");

    expect(cancel.ok).toBe(true);
    expect(supersede.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/tasks/203/evidence/bundles/bundle-501/cancel");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/v1/tasks/203/evidence/bundles/bundle-501/supersede");
  });

  it("loads review assignments and accepts an assignment through v1 review routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: reviewContext(), error: null, requestId: "req-reviews" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: reviewContext({ assignmentStatus: "accepted", allowedActions: { bless: true, requestChanges: true, reject: true, recuse: true } }), error: null, requestId: "req-accept" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CerbanimoClient(auth);
    const queue = await client.listReviewAssignments();
    const accepted = await client.acceptReviewAssignment("assignment-801");

    expect(queue.ok).toBe(true);
    expect(queue.data?.assignments?.[0].reviewer_role).toBe("peer_reviewer");
    expect(accepted.data?.allowedActions?.bless).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/reviews/assignments");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/v1/reviews/assignments/assignment-801/accept");
  });

  it("submits peer and PM review decisions without inferring permissions locally", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: reviewContext({ peerReceived: 3, status: "pm_review_open" }), error: null, requestId: "req-bless" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: reviewContext({ peerReceived: 3, status: "accepted_pending_settlement", settlement: "pending" }), error: null, requestId: "req-seal" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CerbanimoClient(auth);
    await client.decidePeerReview("round-701", { assignmentId: "assignment-801", decision: "bless" });
    const sealed = await client.decidePmReview("round-701", { assignmentId: "assignment-901", decision: "seal" });

    expect(sealed.data?.round?.status).toBe("accepted_pending_settlement");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/review-rounds/round-701/peer-decisions");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/v1/review-rounds/round-701/pm-decisions");
  });

  it("confirms evidence submissions through actions instead of legacy submit routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: actionRow({
          id: 99,
          action_uuid: "evidence-action-99",
          status: "confirmed",
          intent_json: { functionName: "tasks.submit_evidence" },
          related_task_id: 203,
          related_automation_run_id: 1001
        }),
        error: null,
        requestId: "req-confirm-evidence"
      }, 202))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: evidenceValidationRunRow(),
        error: null,
        requestId: "req-validation-run"
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CerbanimoClient(auth).executeAction({
      id: "local-evidence-preview",
      kind: "submit_task",
      title: "Submit evidence",
      summary: "Validate evidence before review.",
      risk: "low",
      destructive: false,
      payload: { taskId: 203, bundleId: "bundle-1" },
      requiredPermissions: ["tasks:write", "actions:write"],
      createdAt: "2026-07-02T12:00:00.000Z",
      cerbanimoActionUuid: "evidence-action-99"
    });

    expect(result.ok).toBe(true);
    expect((result.data as { automationRun?: { result?: { status?: string } } }).automationRun?.result?.status).toBe("validation_passed");
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      "http://localhost:4000/api/v1/actions/evidence-action-99/confirm",
      "http://localhost:4000/api/v1/automation/runs/1001"
    ]);
    expect(urls.some((url) => url.includes("/tasks/203/submit"))).toBe(false);
  });

  it("formats object-shaped Cerbanimo errors without [object Object]", async () => {
    mockFetch({
      ok: false,
      data: null,
      error: { code: "BOOTSTRAP_GRAPH_INVALID", message: "Graph is cyclic", details: { stage: "validateTaskGraph" } },
      requestId: "req-error"
    }, 400);

    const result = await new CerbanimoClient(auth).confirmAction("42");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Graph is cyclic");
    expect(result.error).not.toContain("[object Object]");
    expect(result.code).toBe("BOOTSTRAP_GRAPH_INVALID");
    expect(result.requestId).toBe("req-error");
  });

  it("times out Cerbanimo requests with AbortController", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal;
      signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const promise = new CerbanimoClient(auth).getActionDetail("42");
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("REQUEST_TIMEOUT");
  });

  it("does not call legacy project endpoints for the golden create_project execution", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: actionRow({ id: 42, status: "confirmed" }), error: null, requestId: "req-confirm" }, 202))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: actionDetail({ workflowStatus: "queued", actionStatus: "confirmed" }), error: null, requestId: "req-detail" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CerbanimoClient(auth).executeAction({
      ...projectAction(),
      cerbanimoActionId: "42",
      cerbanimoActionUuid: "action-uuid-42"
    });

    expect(result.ok).toBe(true);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).not.toContain("http://localhost:4000/projects/create");
    expect(urls).not.toContain("http://localhost:4000/projects/auto-generate");
    expect(urls.every((url) => url.includes("/api/v1/actions/"))).toBe(true);
  });

  it("loads Game Master quest context through the v1 project API", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: questContext(),
      error: null,
      requestId: "req-quest"
    });

    const result = await new CerbanimoClient(auth).getQuestContext(100);

    expect(result.ok).toBe(true);
    expect(result.data?.questProfile?.title).toBe("Be The Bag");
    expect(result.data?.party?.members?.[0].calling?.roleArchetype).toBe("steward");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/projects/100/quest-context");
  });

  it("updates Game Master narrative preferences through the profile API", async () => {
    const fetchMock = mockFetch({
      ok: true,
      data: {
        preferences: {
          presentationMode: "plain",
          narrativeIntensity: "light",
          preferredGenres: [],
          avoidThemes: ["horror"],
          statDisplayMode: "numeric"
        }
      },
      error: null,
      requestId: "req-gm"
    });

    const result = await new CerbanimoClient(auth).updateNarrativePreferences({ presentationMode: "plain" });

    expect(result.ok).toBe(true);
    expect(result.data?.preferences.presentationMode).toBe("plain");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/me/narrative-preferences");
  });

  it("creates and redeems Game Master party invites without using legacy endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          invite: { id: 901, projectId: 100, status: "active", maxUses: 1, useCount: 0 },
          token: "raw-token",
          inviteUrl: "http://localhost:3000/project-invites/raw-token",
          warning: "returned once"
        },
        error: null,
        requestId: "req-invite"
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          projectId: 100,
          calling: { id: 33, projectId: 100, roleArchetype: "party_member", callingTitle: "New Companion" }
        },
        error: null,
        requestId: "req-redeem"
      }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CerbanimoClient(auth);
    const created = await client.createProjectInvite(100);
    const redeemed = await client.redeemProjectInvite("raw-token");

    expect(created.ok).toBe(true);
    expect(created.data?.token).toBe("raw-token");
    expect(redeemed.data?.calling?.roleArchetype).toBe("party_member");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/v1/projects/100/invites");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/v1/project-invites/raw-token/redeem");
  });
});

function projectAction(): ActionPreview {
  return {
    id: "preview-local",
    kind: "create_project",
    title: "Create project: Build a Democratic Digital Economy",
    summary: "Kamiya will ask Cerbanimo to bootstrap a project.",
    risk: "low",
    destructive: false,
    requiredPermissions: ["projects:create"],
    createdAt: "2026-07-02T12:00:00.000Z",
    functionName: "projects.bootstrap",
    payload: {
      name: "Build a Democratic Digital Economy",
      description: "Design and implement a digital economic system grounded in voluntary cooperation.",
      outcomeStatement: "A working platform where groups can coordinate economic activity without fixed hierarchy.",
      tags: ["cooperative economics"],
      dueDate: "2027-01-02",
      generationMode: "plan_then_tasks"
    }
  };
}

function actionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    action_uuid: "action-uuid-42",
    status: "previewed",
    risk_level: "low",
    intent_json: { functionName: "projects.bootstrap" },
    preview_payload: {},
    execution_result: null,
    related_project_id: null,
    created_at: "2026-07-02T12:00:00.000Z",
    ...overrides
  };
}

function actionDetail({
  workflowStatus,
  actionStatus,
  activeTasks
}: {
  workflowStatus: string;
  actionStatus: string;
  activeTasks?: Array<Record<string, unknown>>;
}) {
  const hydratedTasks = activeTasks ?? [{ id: 200, name: "Map governance requirements", status: "active-unassigned" }];
  return {
    action: actionRow({ status: actionStatus, related_project_id: workflowStatus === "completed" ? 100 : null }),
    workflow: {
      id: "wf-1",
      status: workflowStatus,
      workflow_type: "projects.bootstrap",
      action_id: 42,
      related_project_id: workflowStatus === "completed" ? 100 : null,
      attempt_count: 1
    },
    steps: [
      { id: 1, step_name: "validateInput", status: "completed" },
      { id: 2, step_name: "generateProjectPlan", status: workflowStatus === "queued" ? "pending" : "completed" }
    ],
    project: workflowStatus === "completed" ? { id: 100, name: "Build a Democratic Digital Economy", description: "A project." } : null,
    tasks: workflowStatus === "completed" ? hydratedTasks : [],
    activeTasks: workflowStatus === "completed" ? hydratedTasks : [],
    terminal: workflowStatus === "completed",
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
      automation: {
        classification: "fully_automatable",
        requiredHumanInputs: [],
        requirements: { capabilities: ["github.run_quality_checks"], expectedArtifacts: ["quality-check-report"] },
        validationRequirements: [],
        source: "generated"
      }
    },
    automation: {
      classification: "fully_automatable",
      requiredHumanInputs: [],
      requirements: { capabilities: ["github.run_quality_checks"], expectedArtifacts: ["quality-check-report"] },
      validationRequirements: [],
      source: "generated"
    },
    inputSchema: [
      { key: "repository", label: "Repository", inputType: "repository", required: true, sensitive: false },
      { key: "ref", label: "Ref", inputType: "text", required: true, sensitive: false },
      { key: "checkProfile", label: "Check profile", inputType: "choice", required: true, sensitive: false },
      { key: "approval", label: "Approval", inputType: "approval", required: true, sensitive: false }
    ],
    preparation: { id: 5, status: "previewed", capability_name: "github.run_quality_checks" },
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

function taskEvidenceContext() {
  return {
    task: { id: 203, name: "Run baseline repository quality checks", status: "active-unassigned" },
    requirements: [{
      requirementId: "proof",
      description: "Show the work was completed.",
      acceptedEvidenceTypes: ["text", "url_snapshot"],
      checks: ["evidence_present", "reflection_present"]
    }],
    bundles: [{
      id: 501,
      bundle_uuid: "bundle-501",
      task_id: 203,
      status: "draft",
      source_kind: "human",
      items: []
    }],
    validations: []
  };
}

function reviewContext(options: { assignmentStatus?: string; allowedActions?: Record<string, boolean>; peerReceived?: number; status?: string; settlement?: string } = {}) {
  return {
    reviewFeature: { enabled: true, policyVersion: "task-review-v1", manifestVersionRequired: "evidence-manifest-v2" },
    round: {
      id: 701,
      round_uuid: "round-701",
      task_id: 203,
      bundle_id: 501,
      status: options.status ?? "peer_review_open",
      stage: options.status === "accepted_pending_settlement" ? "accepted" : "peer_review",
      risk_tier: "standard",
      peer_approvals_required: 3,
      peer_approvals_received: options.peerReceived ?? 1,
      settlement_status: options.settlement ?? null
    },
    assignments: [{
      id: 801,
      assignment_uuid: "assignment-801",
      review_round_id: 701,
      reviewer_role: "peer_reviewer",
      status: options.assignmentStatus ?? "offered"
    }],
    assignment: {
      id: 801,
      assignment_uuid: "assignment-801",
      review_round_id: 701,
      reviewer_role: "peer_reviewer",
      status: options.assignmentStatus ?? "offered"
    },
    decisions: [],
    allowedActions: options.allowedActions ?? { acceptAssignment: true, recuse: true }
  };
}

function evidenceValidationRunRow() {
  return {
    id: 1001,
    run_uuid: "validation-run-1001",
    status: "completed",
    template_key: "submission_validation",
    result: {
      status: "validation_passed",
      summary: "Evidence validation passed.",
      submittedTask: true,
      requirementResults: [{ requirementId: "proof", verdict: "satisfied", description: "Show the work was completed." }]
    },
    logs: []
  };
}

function questContext() {
  return {
    project: { id: 100, name: "Be The Bag", description: "Create a durable mutual aid tote project." },
    questProfile: {
      id: 1,
      projectId: 100,
      title: "Be The Bag",
      premise: "Make reusable bags a visible local ritual.",
      desiredOutcome: "A practical, recurring bag-sharing network.",
      genre: "hopeful adventure",
      tone: "collaborative",
      keyThemes: ["mutual aid"]
    },
    narrativeSettings: {
      projectId: 100,
      presentationMode: "game_master",
      narrativeIntensity: "standard",
      statDisplayMode: "both"
    },
    party: {
      settings: { projectId: 100, minPartySize: 1, targetPartySize: 3, maxPartySize: 7, openRecruitment: true, inviteRequired: false },
      members: [{ userId: 1, username: "Glaed", isProjectCreator: true, calling: { title: "Quest Steward", roleArchetype: "steward" } }],
      shortage: true
    },
    tasks: [{ id: 200, name: "Gather bag designs", status: "active-unassigned" }],
    review: { activeRounds: [], acceptedPendingSettlement: 0 },
    chronicle: [],
    allowedActions: { createInvite: true, launchQuest: true, updateCalling: true },
    safety: { noRewardOrCompletionClaims: true }
  };
}

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(body, status));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
