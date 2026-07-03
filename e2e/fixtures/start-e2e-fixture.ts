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
  created_at: string;
  confirmed_at?: string;
  pollCount: number;
  confirmCount: number;
}

const actions = new Map<string, FixtureAction>();
let nextActionId = 1;
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
  action.execution_result = {
    status: "queued",
    message: "Project bootstrap action confirmed and queued for worker execution."
  };
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
  savedChats.length = 0;
  nextActionId = 1;
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
      taskCount: 3,
      activeTaskCount: 2,
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
      dependencies: []
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
      dependencies: []
    },
    {
      id: 203,
      project_id: 100,
      name: "Publish coordination ledger",
      description: "Expose transparent economic activity records after the governance model is defined.",
      status: "inactive-unassigned",
      skill_name: "Backend engineering",
      skill_level: 3,
      reward_tokens: 50,
      dependencies: [201, 202]
    }
  ];
}

function activeTasks() {
  return allTasks().filter((task) => task.status.startsWith("active"));
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
