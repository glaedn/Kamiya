import express from "express";

const args = new Map(process.argv.slice(2).map((arg, index, all) => [arg, all[index + 1]]));
const kamiyaPort = Number(args.get("--port") ?? process.env.PORT ?? 4178);
const fixturePort = Number(process.env.CERBANIMO_E2E_FIXTURE_PORT ?? 4998);

interface FixtureAction {
  id: number;
  action_uuid: string;
  status: string;
  risk_level: string;
  intent_json: Record<string, unknown>;
  preview_payload: Record<string, unknown>;
  execution_result: unknown;
  related_project_id: number | null;
  related_automation_run_id?: number | null;
  created_at: string;
  confirmed_at?: string;
  pollCount: number;
  confirmCount: number;
}

const actions = new Map<string, FixtureAction>();
const automationRuns = new Map<string, Record<string, unknown>>();
let nextActionId = 1;
let nextPreparationId = 1;
let nextRunId = 1;
const savedChats: unknown[] = [];

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cerbanimo-e2e-fixture" });
});

app.post("/api/v1/actions/preview", (req, res) => {
  const id = nextActionId++;
  const action: FixtureAction = {
    id,
    action_uuid: `e2e-action-${id}`,
    status: "previewed",
    risk_level: req.body?.riskLevel ?? "low",
    intent_json: req.body?.intent ?? {},
    preview_payload: req.body?.previewPayload ?? {},
    execution_result: null,
    related_project_id: null,
    created_at: new Date("2026-07-02T12:00:00.000Z").toISOString(),
    pollCount: 0,
    confirmCount: 0
  };
  actions.set(String(id), action);
  actions.set(action.action_uuid, action);
  res.status(201).json(envelope(action, "fixture-preview"));
});

app.post("/api/v1/actions/:id/confirm", (req, res) => {
  const action = actions.get(req.params.id);
  if (!action) return res.status(404).json(errorEnvelope("ACTION_NOT_FOUND", "Action not found"));
  action.confirmCount += 1;
  if (action.status !== "previewed") {
    return res.status(409).json(errorEnvelope("ACTION_ALREADY_CONFIRMED", `Action cannot be confirmed from status ${action.status}`));
  }
  action.status = "confirmed";
  action.confirmed_at = new Date("2026-07-02T12:00:05.000Z").toISOString();
  if (action.intent_json?.functionName === "tasks.run_automation") {
    const runId = nextRunId++;
    const preparationId = Number((action.intent_json?.arguments as Record<string, unknown> | undefined)?.preparationId ?? 1);
    action.related_automation_run_id = runId;
    action.execution_result = {
      status: "queued",
      message: "Automation action confirmed and queued for worker execution.",
      automationRunId: runId
    };
    automationRuns.set(String(runId), automationRun(runId, preparationId));
  } else {
    action.execution_result = {
      status: "queued",
      message: "Project bootstrap action confirmed and queued for worker execution."
    };
  }
  res.status(202).json(envelope(action, "fixture-confirm"));
});

app.get("/api/v1/actions/:id", (req, res) => {
  const action = actions.get(req.params.id);
  if (!action) return res.status(404).json(errorEnvelope("ACTION_NOT_FOUND", "Action not found"));
  if (action.status !== "previewed") action.pollCount += 1;
  res.json(envelope(detailFor(action), "fixture-detail"));
});

app.get("/api/v1/actions", (_req, res) => {
  const unique = [...new Map([...actions.values()].map((action) => [action.id, action])).values()];
  res.json(envelope({ actions: unique }, "fixture-list"));
});

app.get("/api/v1/tasks/:taskId/automation", (req, res) => {
  const task = allTasks().find((item) => String(item.id) === String(req.params.taskId));
  if (!task) return res.status(404).json(errorEnvelope("TASK_NOT_FOUND", "Task not found"));
  const inputSchema = inputSchemaForTask(task);
  res.json(envelope({
    task,
    automation: task.automation,
    inputSchema,
    preparation: null,
    validation: {
      valid: false,
      errors: inputSchema.filter((field) => field.required).map((field) => ({ key: field.key, code: "REQUIRED", message: `${field.label} is required.` })),
      findings: []
    },
    capability: fixtureCapability(task, false),
    policies: { modifyingActionsRequirePreview: true, rawSecretsAccepted: false }
  }, "fixture-task-automation"));
});

app.post("/api/v1/tasks/:taskId/automation/preparations", (req, res) => {
  const task = allTasks().find((item) => String(item.id) === String(req.params.taskId));
  if (!task) return res.status(404).json(errorEnvelope("TASK_NOT_FOUND", "Task not found"));
  const inputSchema = inputSchemaForTask(task);
  const inputValues = req.body?.inputValues ?? {};
  const capabilityName = req.body?.capabilityName ?? firstCapability(task) ?? null;
  const valid = Boolean(inputValues.repository && inputValues.ref && inputValues.checkProfile && inputValues.approval);
  const preparationId = nextPreparationId++;
  const preparation = {
    id: preparationId,
    preparation_uuid: `fixture-prep-${preparationId}`,
    task_id: task.id,
    actor_user_id: 1,
    capability_name: capabilityName,
    status: valid ? "ready" : "draft",
    input_schema_snapshot: inputSchema,
    input_values: inputValues,
    validation_result: { valid, errors: valid ? [] : [{ key: "repository", code: "REQUIRED", message: "Repository is required." }], findings: [] },
    capability_snapshot: fixtureCapability(task, valid),
    created_at: new Date("2026-07-02T12:00:06.000Z").toISOString(),
    updated_at: new Date("2026-07-02T12:00:06.000Z").toISOString()
  };
  res.status(201).json(envelope({
    task,
    automation: task.automation,
    inputSchema,
    preparation,
    validation: preparation.validation_result,
    capability: preparation.capability_snapshot
  }, "fixture-preparation"));
});

app.post("/api/v1/tasks/:taskId/automation/preparations/:preparationId/preview", (req, res) => {
  const task = allTasks().find((item) => String(item.id) === String(req.params.taskId));
  if (!task) return res.status(404).json(errorEnvelope("TASK_NOT_FOUND", "Task not found"));
  const id = nextActionId++;
  const preparationId = Number(req.params.preparationId);
  const action: FixtureAction = {
    id,
    action_uuid: `e2e-automation-action-${id}`,
    status: "previewed",
    risk_level: "normal",
    intent_json: {
      functionName: "tasks.run_automation",
      arguments: {
        taskId: task.id,
        preparationId,
        capabilityName: "github.run_quality_checks"
      },
      automation: {
        templateKey: "run_quality_checks",
        input: {
          taskId: task.id,
          preparationId,
          capabilityName: "github.run_quality_checks"
        }
      }
    },
    preview_payload: {
      title: `Run quality checks for ${task.name}`,
      summary: "Cerbanimo will run deterministic quality checks and attach the report.",
      confirmationRequired: true
    },
    execution_result: null,
    related_project_id: 100,
    created_at: new Date("2026-07-02T12:00:07.000Z").toISOString(),
    pollCount: 0,
    confirmCount: 0
  };
  actions.set(String(id), action);
  actions.set(action.action_uuid, action);
  res.status(201).json(envelope({
    task,
    automation: task.automation,
    inputSchema: inputSchemaForTask(task),
    preparation: { id: preparationId, status: "previewed", capability_name: "github.run_quality_checks" },
    validation: { valid: true, errors: [], findings: [] },
    capability: fixtureCapability(task, true),
    action,
    template: { key: "run_quality_checks", name: "Run Quality Checks", status: "available" }
  }, "fixture-automation-preview"));
});

app.get("/api/v1/automation/runs/:id", (req, res) => {
  const run = automationRuns.get(req.params.id);
  if (!run) return res.status(404).json(errorEnvelope("RUN_NOT_FOUND", "Automation run not found"));
  res.json(envelope(run, "fixture-run"));
});

app.get("/kamiya/chats", (_req, res) => {
  res.json({
    chats: savedChats.map((chat, index) => ({ id: index + 1, name: `E2E Quest ${index + 1}`, messageCount: 1 }))
  });
});

app.post("/kamiya/chats", (req, res) => {
  const id = typeof req.body?.chatId === "number" ? req.body.chatId : savedChats.length + 1;
  const chat = { id, name: req.body?.name ?? "E2E Quest", messages: req.body?.messages ?? [], session: req.body?.session ?? {} };
  savedChats[id - 1] = chat;
  res.json({ chat });
});

app.get("/kamiya/chats/:id", (req, res) => {
  const chat = savedChats[Number(req.params.id) - 1];
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat });
});

app.post("/api/v1/actions/:id/cancel", (req, res) => {
  const action = actions.get(req.params.id);
  if (!action) return res.status(404).json(errorEnvelope("ACTION_NOT_FOUND", "Action not found"));
  action.status = "cancelled";
  res.json(envelope(action, "fixture-cancel"));
});

app.post("/api/v1/actions/:id/retry", (req, res) => {
  const action = actions.get(req.params.id);
  if (!action) return res.status(404).json(errorEnvelope("ACTION_NOT_FOUND", "Action not found"));
  action.status = "confirmed";
  action.pollCount = 0;
  res.status(202).json(envelope(action, "fixture-retry"));
});

app.get("/__fixture/state", (_req, res) => {
  const unique = [...new Map([...actions.values()].map((action) => [action.id, action])).values()];
  res.json({
    actions: unique.length,
    confirms: unique.reduce((sum, action) => sum + action.confirmCount, 0),
    projects: unique.filter((action) => detailFor(action).project).length
  });
});

app.post("/__fixture/reset", (_req, res) => {
  actions.clear();
  automationRuns.clear();
  savedChats.length = 0;
  nextActionId = 1;
  nextPreparationId = 1;
  nextRunId = 1;
  res.json({ ok: true });
});

await new Promise<void>((resolve) => {
  app.listen(fixturePort, "127.0.0.1", resolve);
});

process.env.PORT = String(kamiyaPort);
process.env.KAMIYA_CERBANIMO_API_URL = `http://127.0.0.1:${fixturePort}`;
process.env.KAMIYA_ALLOWED_ORIGIN = `http://127.0.0.1:${kamiyaPort}`;
process.env.KAMIYA_GEMINI_API_KEY = "";
process.env.KAMIYA_CERBANIMO_TIMEOUT_MS = "5000";
process.env.KAMIYA_E2E_NOW = "2026-07-02T12:00:00.000-04:00";
process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REPOSITORY = "glaedn/Kamiya";
process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REF = "main";

await import("../../server/index");

function detailFor(action: FixtureAction) {
  const stageIndex = Math.min(Math.max(action.pollCount - 1, 0), bootstrapStages.length - 1);
  const completed = action.pollCount >= bootstrapStages.length + 2;
  const workflowStatus = action.status === "cancelled"
    ? "cancelled"
    : completed
      ? "completed"
      : action.pollCount <= 1
        ? "queued"
        : "running";

  if (completed) {
    action.status = "executed";
    action.related_project_id = 100;
    action.execution_result = {
      status: "executed",
      projectId: 100,
      taskCount: 4,
      activeTaskCount: 3,
      activeTasks: activeTasks()
    };
  }

  return {
    action,
    workflow: action.status === "previewed"
      ? null
      : {
          id: "fixture-workflow-1",
          workflow_type: "projects.bootstrap",
          status: workflowStatus,
          action_id: action.id,
          related_project_id: completed ? 100 : null,
          attempt_count: 1,
          state: { input: action.intent_json?.arguments ?? {} },
          last_error: null,
          created_at: "2026-07-02T12:00:05.000Z",
          updated_at: "2026-07-02T12:00:10.000Z"
        },
    steps: bootstrapStages.map((step, index) => ({
      id: index + 1,
      workflow_run_id: "fixture-workflow-1",
      step_name: step,
      status: completed || index < stageIndex ? "completed" : index === stageIndex && action.pollCount > 1 ? "running" : "pending",
      result: null
    })),
    project: completed
      ? {
          id: 100,
          name: "Build a Democratic Digital Economy",
          description:
            "Design and implement a digital economic system grounded in voluntary cooperation, non-hierarchical collaboration, and democratically governed group constitutions.",
          due_date: "2027-01-02"
        }
      : null,
    tasks: completed ? allTasks() : [],
    activeTasks: completed ? activeTasks() : [],
    terminal: completed || action.status === "cancelled",
    result: action.execution_result,
    error: null
  };
}

function allTasks() {
  return [
    {
      id: 201,
      project_id: 100,
      name: "Map governance requirements",
      description: "Interview prospective groups and define constitution decision flows.",
      status: "active-unassigned",
      skill_name: "Product research",
      skill_level: 2,
      reward_tokens: 25,
      dependencies: [],
      automation: humanAutomation()
    },
    {
      id: 202,
      project_id: 100,
      name: "Prototype constitution voting",
      description: "Build the first democratic constitution proposal and revision workflow.",
      status: "active-unassigned",
      skill_name: "Frontend engineering",
      skill_level: 3,
      reward_tokens: 40,
      dependencies: [],
      automation: assistedAutomation()
    },
    {
      id: 203,
      project_id: 100,
      name: "Run baseline repository quality checks",
      description: "Run the known repository quality-check command and return a bounded report.",
      status: "active-unassigned",
      skill_name: "Quality assurance",
      skill_level: 2,
      reward_tokens: 50,
      dependencies: [],
      automation: fullyAutomatableAutomation()
    },
    {
      id: 204,
      project_id: 100,
      name: "Launch pilot readiness review",
      description: "Confirm governance, prototype, and quality-check evidence before the pilot opens.",
      status: "blocked",
      skill_name: "Project coordination",
      skill_level: 2,
      reward_tokens: 30,
      dependencies: [201, 202, 203],
      automation: humanAutomation()
    }
  ];
}

function activeTasks() {
  return allTasks().filter((task) => task.status.startsWith("active"));
}

function humanAutomation() {
  return {
    classification: "human_driven",
    confidenceBand: "high",
    rationale: "This task requires stakeholder interviews and judgment.",
    requiredHumanInputs: [],
    requirements: {},
    validationRequirements: [{ requirementId: "notes", description: "Stakeholder notes are reviewed.", proofTypes: ["document"], checks: ["human_review"] }],
    source: "generated",
    version: "task-automation-v1",
    findings: []
  };
}

function assistedAutomation() {
  return {
    classification: "assisted_automation",
    confidenceBand: "medium",
    rationale: "Kamiya can help once repository, branch, criteria, and approval are supplied.",
    requiredHumanInputs: [
      { key: "repository", label: "Repository", description: "Repository to work in.", inputType: "repository", required: true, sensitive: false },
      { key: "target_branch", label: "Target branch", description: "Branch to target.", inputType: "text", required: true, sensitive: false },
      { key: "acceptance_criteria", label: "Acceptance criteria", description: "Review criteria.", inputType: "long_text", required: true, sensitive: false },
      { key: "approval", label: "Approval", description: "Approval before external effects.", inputType: "approval", required: true, sensitive: false }
    ],
    requirements: { capabilities: ["github.generate_pull_request"], expectedArtifacts: ["pull-request-draft"], networkAccess: "restricted" },
    validationRequirements: [{ requirementId: "approval", description: "Human approval is recorded.", proofTypes: ["review_note"], checks: ["human_approval"] }],
    source: "generated",
    version: "task-automation-v1",
    findings: []
  };
}

function fullyAutomatableAutomation() {
  return {
    classification: "fully_automatable",
    confidenceBand: "high",
    rationale: "This task is bounded digital verification with an explicit report artifact.",
    requiredHumanInputs: [],
    requirements: { capabilities: ["github.run_quality_checks"], expectedArtifacts: ["quality-check-report"], tools: ["git", "npm"], networkAccess: "restricted" },
    validationRequirements: [{ requirementId: "checks-pass", description: "Command result is captured.", proofTypes: ["automation_log", "command_result"], checks: ["exit_code_recorded"] }],
    source: "generated",
    version: "task-automation-v1",
    findings: []
  };
}

function inputSchemaForTask(task: ReturnType<typeof allTasks>[number]) {
  if (capabilitiesFor(task).includes("github.run_quality_checks")) return qualityCheckInputSchema();
  return task.automation.requiredHumanInputs;
}

function capabilitiesFor(task: ReturnType<typeof allTasks>[number]): string[] {
  const value = (task.automation.requirements as { capabilities?: string[] }).capabilities;
  return Array.isArray(value) ? value : [];
}

function firstCapability(task: ReturnType<typeof allTasks>[number]): string | undefined {
  return capabilitiesFor(task)[0];
}

function qualityCheckInputSchema() {
  return [
    { key: "repository", label: "Repository", description: "Repository to check.", inputType: "repository", required: true, sensitive: false },
    { key: "ref", label: "Ref", description: "Branch, tag, or commit SHA.", inputType: "text", required: true, sensitive: false },
    { key: "checkProfile", label: "Check profile", description: "Quality-check profile.", inputType: "choice", required: true, sensitive: false, options: [{ value: "node_standard", label: "Node standard" }] },
    { key: "approval", label: "Quality-check approval", description: "Approval to run repository code.", inputType: "approval", required: true, sensitive: false }
  ];
}

function fixtureCapability(task: ReturnType<typeof allTasks>[number], ready: boolean) {
  const capabilityName = firstCapability(task) ?? null;
  const executable = capabilityName === "github.run_quality_checks" && ready;
  return {
    classification: task.automation.classification,
    requiredCapabilities: capabilityName ? [capabilityName] : [],
    availableCapabilities: executable ? [capabilityName] : [],
    missingCapabilities: executable || !capabilityName ? [] : [capabilityName],
    actorAuthorized: true,
    executionAvailable: executable,
    templateKey: executable ? "run_quality_checks" : null,
    executor: executable ? "deterministic" : null,
    reasons: executable ? [] : capabilityName === "github.run_quality_checks" ? ["INPUTS_INCOMPLETE"] : ["CAPABILITY_NOT_REGISTERED"]
  };
}

function automationRun(runId: number, preparationId: number) {
  return {
    id: runId,
    run_uuid: `fixture-run-${runId}`,
    action_id: nextActionId - 1,
    preparation_id: preparationId,
    template_key: "run_quality_checks",
    status: "completed",
    input: { taskId: 203, preparationId, capabilityName: "github.run_quality_checks" },
    result: {
      status: "checks_passed",
      reportType: "quality_check",
      taskId: 203,
      taskName: "Run baseline repository quality checks",
      repository: "glaedn/Kamiya",
      ref: "main",
      checkProfile: "node_standard",
      executor: "deterministic",
      summary: "Quality checks passed. Cerbanimo attached this report and submitted the task for review.",
      artifactUri: `cerbanimo://automation-runs/fixture-run-${runId}/quality-check-report`,
      submittedTask: true,
      checks: [
        { key: "dependency_install", status: "passed", message: "Dependencies installed." },
        { key: "typecheck", status: "passed", message: "Type check passed." },
        { key: "lint", status: "passed", message: "Lint passed." },
        { key: "unit_tests", status: "passed", message: "Unit tests passed." },
        { key: "build", status: "passed", message: "Build passed." }
      ],
      completedAt: "2026-07-02T12:00:09.000Z"
    },
    logs: [{ level: "info", message: "Automation run queued after action confirmation.", payload: {}, created_at: "2026-07-02T12:00:08.000Z" }]
  };
}

function envelope(data: unknown, requestId: string) {
  return { ok: true, data, error: null, requestId };
}

function errorEnvelope(code: string, message: string) {
  return { ok: false, data: null, error: { code, message }, requestId: `fixture-${code.toLowerCase()}` };
}

const bootstrapStages = [
  "validateInput",
  "generateProjectPlan",
  "generateTaskGraph",
  "validateTaskGraph",
  "persistProjectGraph",
  "activateRootTasks",
  "finalizeAction"
];
