import type { ActionPreview, CerbanimoResult, KamiyaAuthContext } from "../../shared/types";

export class CerbanimoClient {
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly auth: KamiyaAuthContext;

  constructor(auth: KamiyaAuthContext) {
    this.auth = auth;
    this.apiUrl = process.env.KAMIYA_CERBANIMO_API_URL || auth.cerbanimoApiUrl || "";
    this.token = process.env.KAMIYA_CERBANIMO_BEARER_TOKEN || auth.cerbanimoToken;
  }

  async executeAction(action: ActionPreview): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: false,
        error: `Kamiya cannot execute "${action.title}" yet because Cerbanimo API credentials are not configured on the backend. Set ${this.apiUrl ? "" : "KAMIYA_CERBANIMO_API_URL"}${!this.apiUrl && !this.token ? " and " : ""}${this.token ? "" : "KAMIYA_CERBANIMO_BEARER_TOKEN"} in the server environment, then restart Kamiya. The action preview is still safe and no Cerbanimo data was modified.`
      };
    }

    if (action.kind === "create_project") {
      return this.createProject(action);
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

  private async createProject(action: ActionPreview): Promise<CerbanimoResult> {
    const auth0Id = this.auth0IdForProject(action.payload);
    if (!auth0Id) {
      return {
        ok: false,
        error: "Kamiya cannot create this Cerbanimo project because the Auth0 user id is missing. Log out and log back in through the Cerbanimo Auth0 bridge, then try again."
      };
    }

    const createPayload = {
      name: action.payload.name,
      description: action.payload.description,
      tags: Array.isArray(action.payload.tags) ? action.payload.tags : [],
      auth0_id: auth0Id,
      outcomeStatement: action.payload.outcomeStatement,
      due_date: action.payload.due_date ?? null,
      location: action.payload.location ?? null,
      auto_assign: Boolean(action.payload.auto_assign),
      is_service: Boolean(action.payload.is_service),
      service_visibility: action.payload.service_visibility ?? ["private"],
      service_price: action.payload.service_price ?? 0
    };

    const created = await this.request("/projects/create", "POST", createPayload);
    if (!created.ok) return created;

    if (action.payload.autoGeneratePlan === false) return created;

    const project = (created.data ?? {}) as Record<string, unknown>;
    const projectId = project.id;
    if (!projectId) return created;

    const generated = await this.request("/projects/auto-generate", "POST", { projectId });
    return {
      ok: true,
      data: {
        project,
        autoGenerate: generated.ok ? generated.data : { ok: false, error: generated.error }
      }
    };
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

    return this.request("/actions", "GET");
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

  private async request(path: string, method: string, body?: unknown): Promise<CerbanimoResult> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json"
      },
      body: body && method !== "GET" ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
      return {
        ok: false,
        error: data?.message ?? data?.error ?? `${response.status} ${response.statusText}`
      };
    }

    return { ok: true, data };
  }

  private auth0IdForProject(payload: Record<string, unknown>): string | undefined {
    const explicit = payload.auth0_id ?? payload.auth0Id;
    if (typeof explicit === "string" && explicit.trim()) return explicit;
    if (this.auth.userId?.trim()) return this.auth.userId;
    if (this.auth.externalUserId?.trim()) return this.auth.externalUserId;
    return undefined;
  }
}
