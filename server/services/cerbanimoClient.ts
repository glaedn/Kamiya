import { z } from "zod";
import type {
  ActionPreview,
  ActiveCerbanimoActionState,
  CerbanimoAction,
  CerbanimoResult,
  ChatMessage,
  KamiyaAuthContext,
  KamiyaSavedChat,
  KamiyaSavedChatSummary,
  KamiyaSessionState,
  ProjectBootstrapActionDetail
} from "../../shared/types";

const apiEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().nullable().optional(),
  error: z.unknown().nullable().optional(),
  requestId: z.string().optional()
});

const cerbanimoActionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  action_uuid: z.string().optional().nullable(),
  status: z.string(),
  risk_level: z.string().optional().nullable(),
  intent_json: z.record(z.unknown()).optional().nullable(),
  preview_payload: z.record(z.unknown()).optional().nullable(),
  execution_result: z.unknown().optional().nullable(),
  related_project_id: z.number().optional().nullable(),
  created_at: z.string().optional().nullable(),
  confirmed_at: z.string().optional().nullable(),
  executed_at: z.string().optional().nullable()
}).passthrough();

const taskAutomationSchema = z.object({
  classification: z.enum(["human_driven", "assisted_automation", "fully_automatable"]).catch("human_driven"),
  confidenceBand: z.enum(["low", "medium", "high"]).nullable().optional().catch(null),
  rationale: z.string().optional().catch(undefined),
  requiredHumanInputs: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
    inputType: z.string(),
    required: z.boolean().default(true),
    sensitive: z.boolean().default(false),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional()
  }).passthrough()).default([]).catch([]),
  requirements: z.object({
    capabilities: z.array(z.string()).optional().catch([]),
    tools: z.array(z.string()).optional().catch([]),
    externalServices: z.array(z.string()).optional().catch([]),
    permissions: z.array(z.string()).optional().catch([]),
    expectedArtifacts: z.array(z.string()).optional().catch([]),
    estimatedDurationMinutes: z.number().optional(),
    networkAccess: z.enum(["none", "restricted", "required"]).optional().catch("none")
  }).passthrough().default({}).catch({}),
  validationRequirements: z.array(z.object({
    requirementId: z.string(),
    description: z.string().optional(),
    proofTypes: z.array(z.string()).optional(),
    checks: z.array(z.string()).optional()
  }).passthrough()).default([]).catch([]),
  source: z.enum(["generated", "manual", "legacy_default", "policy_downgrade", "review_override"]).optional().catch("legacy_default"),
  version: z.string().optional(),
  classifiedAt: z.string().nullable().optional(),
  findings: z.array(z.object({
    code: z.string().optional(),
    field: z.string().optional(),
    message: z.string().optional()
  }).passthrough()).default([]).catch([])
}).passthrough().catch({
  classification: "human_driven",
  requiredHumanInputs: [],
  requirements: {},
  validationRequirements: [],
  source: "legacy_default",
  findings: []
});

const taskSchema = z.object({
  id: z.union([z.number(), z.string()]),
  automation: taskAutomationSchema.optional().default({
    classification: "human_driven",
    requiredHumanInputs: [],
    requirements: {},
    validationRequirements: [],
    source: "legacy_default",
    findings: []
  })
}).passthrough();

const projectBootstrapActionDetailSchema = z.object({
  action: cerbanimoActionSchema,
  workflow: z.object({
    id: z.union([z.number(), z.string()]),
    status: z.string(),
    workflow_type: z.string().optional().nullable(),
    action_id: z.union([z.number(), z.string()]).optional().nullable(),
    related_project_id: z.number().optional().nullable(),
    attempt_count: z.number().optional().nullable(),
    state: z.record(z.unknown()).optional().nullable(),
    last_error: z.unknown().optional().nullable(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable()
  }).passthrough().nullable().optional(),
  steps: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(),
    workflow_run_id: z.union([z.number(), z.string()]).optional(),
    step_name: z.string(),
    status: z.string(),
    result: z.unknown().optional().nullable(),
    payload: z.unknown().optional().nullable(),
    started_at: z.string().optional().nullable(),
    completed_at: z.string().optional().nullable()
  }).passthrough()).default([]),
  project: z.object({ id: z.number() }).passthrough().nullable().optional(),
  tasks: z.array(taskSchema).default([]),
  activeTasks: z.array(taskSchema).default([]),
  terminal: z.boolean().default(false),
  result: z.unknown().optional().nullable(),
  error: z.unknown().optional().nullable()
}).passthrough();

const defaultRequestTimeoutMs = 15_000;

export class CerbanimoClient {
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly auth: KamiyaAuthContext;

  constructor(auth: KamiyaAuthContext) {
    this.auth = auth;
    this.apiUrl = process.env.KAMIYA_CERBANIMO_API_URL || auth.cerbanimoApiUrl || "";
    this.token = auth.cerbanimoToken || process.env.KAMIYA_CERBANIMO_BEARER_TOKEN;
  }

  async previewProjectBootstrap(action: ActionPreview): Promise<CerbanimoResult<{
    action: CerbanimoAction;
    preview: ActionPreview;
    activeAction: ActiveCerbanimoActionState;
  }>> {
    if (!this.hasUserToken()) return this.missingUserAuthResult("prepare a Cerbanimo project preview");
    const bootstrapArguments = {
      name: action.payload.name,
      description: action.payload.description,
      outcomeStatement: action.payload.outcomeStatement,
      dueDate: action.payload.dueDate ?? action.payload.due_date ?? null,
      tags: action.payload.tags ?? [],
      generationMode: action.payload.generationMode ?? "plan_then_tasks",
      autoAssign: action.payload.auto_assign ?? false,
      location: action.payload.location ?? null,
      isService: action.payload.is_service ?? false,
      serviceVisibility: action.payload.service_visibility ?? ["private"],
      servicePrice: action.payload.service_price ?? 0,
      ...e2eBootstrapArguments(action.payload)
    };

    const result = await this.previewAction({
      intent: {
        functionName: "projects.bootstrap",
        arguments: bootstrapArguments
      },
      previewPayload: {
        title: action.title,
        summary: action.summary,
        project: {
          name: action.payload.name,
          description: action.payload.description,
          outcomeStatement: action.payload.outcomeStatement,
          dueDate: action.payload.dueDate ?? action.payload.due_date ?? null,
          tags: action.payload.tags ?? []
        },
        effects: [
          "Generate a project plan",
          "Generate and validate a task dependency graph",
          "Persist the project, outcome, tasks, and impact nodes atomically",
          "Activate root tasks once dependencies are clear"
        ],
        confirmationRequired: true,
        permissions: action.requiredPermissions
      },
      sourceClient: "kamiya-web",
      riskLevel: action.risk
    });

    if (!result.ok || !result.data) return result as CerbanimoResult<never>;

    const persistedAction = result.data;
    const preview = {
      ...action,
      cerbanimoActionId: String(persistedAction.id),
      cerbanimoActionUuid: persistedAction.action_uuid ?? undefined,
      requestId: result.requestId,
      functionName: "projects.bootstrap"
    };

    return {
      ok: true,
      data: {
        action: persistedAction,
        preview,
        activeAction: this.activeStateFromAction(persistedAction, result.requestId)
      },
      requestId: result.requestId
    };
  }

  async previewAction(body: {
    intent: Record<string, unknown>;
    previewPayload?: Record<string, unknown>;
    sourceClient?: string;
    riskLevel?: string;
  }): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1("/actions/preview", "POST", body, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async confirmAction(actionId: string | number): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/confirm`, "POST", { confirmedBy: "kamiya" }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async getActionDetail(actionId: string | number): Promise<CerbanimoResult<ProjectBootstrapActionDetail>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}`, "GET", undefined, projectBootstrapActionDetailSchema) as Promise<CerbanimoResult<ProjectBootstrapActionDetail>>;
  }

  async cancelAction(actionId: string | number, reason = "Cancelled from Kamiya."): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/cancel`, "POST", { reason }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async retryAction(actionId: string | number, reason = "Retried from Kamiya."): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/retry`, "POST", { reason }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async listActions(input: { limit?: number; status?: string } = {}): Promise<CerbanimoResult<{ actions: CerbanimoAction[] }>> {
    const params = new URLSearchParams();
    if (input.limit) params.set("limit", String(input.limit));
    if (input.status) params.set("status", input.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.requestV1(`/actions${suffix}`, "GET", undefined, z.object({ actions: z.array(cerbanimoActionSchema) })) as Promise<CerbanimoResult<{ actions: CerbanimoAction[] }>>;
  }

  async executeAction(action: ActionPreview): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: false,
        error: `Kamiya cannot execute "${action.title}" yet because Cerbanimo API credentials are not configured on the backend. Set ${this.apiUrl ? "" : "KAMIYA_CERBANIMO_API_URL"}${!this.apiUrl && !this.token ? " and " : ""}${this.token ? "" : "KAMIYA_CERBANIMO_BEARER_TOKEN"} in the server environment, then restart Kamiya. The action preview is still safe and no Cerbanimo data was modified.`
      };
    }

    if (action.kind === "create_project") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      if (!actionId) {
        return {
          ok: false,
          error: "Kamiya cannot confirm this quest because Cerbanimo did not return a persisted action preview. Refresh the draft and try again."
        };
      }
      const confirmed = await this.confirmAction(actionId);
      if (!confirmed.ok) return confirmed;
      const detail = await this.getActionDetail(actionId);
      return detail.ok ? { ...detail, data: { detail: detail.data, action: confirmed.data } } : detail;
    }

    if (action.kind === "submit_task") {
      const taskId = String(action.payload.taskId ?? "");
      return this.request(`/tasks/${encodeURIComponent(taskId)}/submit`, "POST", action.payload);
    }

    if (action.kind === "run_automation") {
      return this.request("/automation/actions", "POST", action.payload);
    }

    return {
      ok: false,
      error: `No Cerbanimo execution mapping exists for ${action.kind}`
    };
  }

  async saveChat(input: {
    chatId?: number;
    name: string;
    messages: ChatMessage[];
    session: KamiyaSessionState;
  }): Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request("/kamiya/chats", "POST", input) as Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>>;
  }

  async listChats(): Promise<CerbanimoResult<{ chats: KamiyaSavedChatSummary[] }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request("/kamiya/chats", "GET") as Promise<CerbanimoResult<{ chats: KamiyaSavedChatSummary[] }>>;
  }

  async loadChat(chatId: number): Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request(`/kamiya/chats/${encodeURIComponent(String(chatId))}`, "GET") as Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>>;
  }

  async search(query: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "task-landing-page", title: "Landing Page Polish", type: "task", status: "open" },
          { id: "project-cerbanimo", title: "Cerbanimo", type: "project", status: "active" },
          { id: "community-builders", title: "Builders Guild", type: "community", status: "open" }
        ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query.trim().length < 4)
      };
    }

    return this.request(`/search?q=${encodeURIComponent(query)}`, "GET");
  }

  async tasks(query = ""): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          {
            id: "task-kamiya-router",
            title: "Harden Kamiya intent router",
            type: "task",
            status: "active",
            project: "Kamiya",
            reward: 35
          },
          {
            id: "task-community-search",
            title: "Wire community search cards",
            type: "task",
            status: "open",
            project: "Cerbanimo",
            reward: 20
          },
          {
            id: "task-approval-copy",
            title: "Review approval notification tone",
            type: "task",
            status: "review",
            project: "Kamiya",
            reward: 15
          }
        ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query.trim().length < 4)
      };
    }

    return this.request(`/tasks?query=${encodeURIComponent(query)}`, "GET");
  }

  async profile(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          displayName: "Glaed",
          level: 7,
          title: "Quest Architect",
          skills: ["planning", "frontend", "automation"],
          activeProjects: 3,
          completedTasks: 18,
          tokens: 420
        }
      };
    }

    return this.request("/profile/me", "GET");
  }

  async notifications(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "notice-task-approved", title: "Task approved", status: "new", body: "Your submitted task was approved." },
          { id: "notice-level", title: "Level gained", status: "new", body: "You reached Level 7." },
          { id: "notice-tokens", title: "Tokens received", status: "seen", body: "You received 35 tokens." }
        ]
      };
    }

    return this.request("/notifications", "GET");
  }

  async automationTemplates(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "research_competitors", title: "Research competitors", status: "available", permission: "automation:create" },
          { id: "generate_project_plan", title: "Generate project plan", status: "available", permission: "automation:create" },
          { id: "create_github_issues", title: "Create GitHub issues", status: "needs GitHub", permission: "integrations:github" },
          { id: "review_pull_request", title: "Review pull request", status: "needs GitHub", permission: "integrations:github" },
          { id: "run_quality_checks", title: "Run quality checks", status: "available", permission: "automation:create" },
          { id: "validate_submission", title: "Validate submitted work", status: "available", permission: "tasks:review" }
        ]
      };
    }

    return this.request("/automation/templates", "GET");
  }

  async actionQueue(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          {
            id: "action-deadline-monitor",
            title: "Monitor deadline risk",
            status: "running",
            summary: "Watching active Kamiya tasks for due-date risk."
          },
          {
            id: "action-quality-check",
            title: "Run quality checks",
            status: "queued",
            summary: "Waiting for repository connection."
          }
        ]
      };
    }

    return this.listActions({ limit: 20 });
  }

  async validationReport(target: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          title: "Validation report",
          target: target || "latest submission",
          status: "ready",
          checks: [
            { id: "proof", title: "Proof attached", status: "passed" },
            { id: "requirements", title: "Requirements matched", status: "needs review" },
            { id: "quality", title: "Quality checks", status: "queued" }
          ]
        }
      };
    }

    return this.request(`/automation/validation-report?target=${encodeURIComponent(target)}`, "GET");
  }

  async renderPage(target: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          target,
          title: target ? `Open ${target}` : "Open Cerbanimo",
          url: `${this.apiUrl || "http://localhost:4000"}/${target.replace(/^\/+/, "") || "dashboard"}`,
          type: "navigation"
        }
      };
    }

    return this.request(`/render/page?target=${encodeURIComponent(target)}`, "GET");
  }

  async stats(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          level: 7,
          experience: 1840,
          tokens: 420,
          streak: 5,
          activeProjects: 3,
          completedTasks: 18
        }
      };
    }

    return this.request("/profile/stats", "GET");
  }

  private async requestV1<T>(path: string, method: string, body?: unknown, schema?: z.ZodType<T>): Promise<CerbanimoResult<T>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo API credentials are not configured." };
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const v1Path = normalizedPath.startsWith("/api/v1/") ? normalizedPath : `/api/v1${normalizedPath}`;
    return this.requestRaw(`${this.apiUrl}${v1Path}`, method, body, schema);
  }

  private async request(path: string, method: string, body?: unknown): Promise<CerbanimoResult> {
    return this.requestRaw(`${this.apiUrl}${path}`, method, body);
  }

  private async requestRaw<T>(url: string, method: string, body?: unknown, schema?: z.ZodType<T>): Promise<CerbanimoResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.KAMIYA_CERBANIMO_TIMEOUT_MS ?? defaultRequestTimeoutMs));

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json"
        },
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        error: isAbort ? "Cerbanimo request timed out." : error instanceof Error ? error.message : "Cerbanimo request failed.",
        code: isAbort ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        retryable: true
      };
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => undefined);
    const envelope = apiEnvelopeSchema.safeParse(data);
    const requestId = response.headers?.get("x-request-id") ?? (envelope.success ? envelope.data.requestId : undefined);

    if (!response.ok) {
      const errorPayload = envelope.success ? envelope.data.error : data;
      return {
        ok: false,
        error: errorMessageFromResponse(errorPayload, response),
        code: errorCodeFromResponse(errorPayload, response),
        status: response.status,
        requestId,
        retryable: response.status >= 500 || response.status === 408 || response.status === 429
      };
    }

    const payload = envelope.success ? envelope.data.data : data;
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        return {
          ok: false,
          error: `Cerbanimo response did not match the expected contract: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
          code: "CONTRACT_PARSE_FAILED",
          status: response.status,
          requestId
        };
      }
      return { ok: true, data: parsed.data, status: response.status, requestId };
    }

    return { ok: true, data: payload as T, status: response.status, requestId };
  }

  private hasUserToken(): boolean {
    return Boolean(this.apiUrl && this.auth.isLoggedIn && this.auth.cerbanimoToken);
  }

  private missingUserAuthResult(actionDescription: string): CerbanimoResult<never> {
    return {
      ok: false,
      error: `Kamiya cannot ${actionDescription} because you are not connected to Cerbanimo with a user-scoped Auth0 token. Log in through the Cerbanimo bridge, then try again.`,
      code: "AUTH_REQUIRED",
      status: 401
    };
  }

  private activeStateFromAction(action: CerbanimoAction, requestId?: string): ActiveCerbanimoActionState {
    return {
      actionId: String(action.id),
      actionUuid: action.action_uuid ?? undefined,
      functionName: "projects.bootstrap",
      status: normalizeActionStatus(action.status),
      projectId: action.related_project_id ?? undefined,
      startedAt: action.created_at ?? new Date().toISOString(),
      lastHydratedAt: new Date().toISOString(),
      requestId
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessageFromResponse(data: unknown, response: Response): string {
  if (isRecord(data)) {
    for (const key of ["message", "error", "detail"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value;
      if (isRecord(value)) return JSON.stringify(value);
    }
    return JSON.stringify(data);
  }

  if (typeof data === "string" && data.trim()) return data;
  return `${response.status} ${response.statusText}`;
}

function errorCodeFromResponse(data: unknown, response: Response): string | number {
  if (isRecord(data)) {
    const code = data.code ?? data.status;
    if (typeof code === "string" || typeof code === "number") return code;
  }
  return response.status;
}

function normalizeActionStatus(status: unknown): ActiveCerbanimoActionState["status"] {
  const value = String(status ?? "previewed");
  if (
    value === "previewed" ||
    value === "confirmed" ||
    value === "queued" ||
    value === "running" ||
    value === "retry_wait" ||
    value === "blocked" ||
    value === "failed" ||
    value === "completed" ||
    value === "executed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "confirmed";
}

function e2eBootstrapArguments(payload: Record<string, unknown>): Record<string, unknown> {
  if (process.env.KAMIYA_REAL_STACK_E2E !== "1") return {};
  return {
    e2eScenario: payload._e2eScenario,
    e2eRunId: payload._e2eRunId,
    e2eControlDir: payload._e2eControlDir
  };
}
