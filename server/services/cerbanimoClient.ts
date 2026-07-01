import type { ActionExecutionRecord, ActionPreview, CerbanimoResult, KamiyaAuthContext } from "../../shared/types";

export class CerbanimoClient {
  private readonly apiUrl: string;
  private readonly token?: string;

  constructor(auth: KamiyaAuthContext) {
    this.apiUrl = auth.cerbanimoApiUrl || process.env.KAMIYA_CERBANIMO_API_URL || "";
    this.token = auth.cerbanimoToken;
  }

  async executeAction(action: ActionPreview): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      const record: ActionExecutionRecord = {
        id: crypto.randomUUID(),
        previewId: action.id,
        kind: action.kind,
        status: action.kind === "run_automation" ? "queued" : "completed",
        title: action.title,
        summary: action.summary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mocked: true,
        cerbanimoActionId: `mock-${action.id}`
      };

      return {
        ok: true,
        mocked: true,
        data: record
      };
    }

    if (action.kind === "create_project") {
      return this.request("/projects", "POST", action.payload);
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
        error: data?.error ?? `${response.status} ${response.statusText}`
      };
    }

    return { ok: true, data };
  }
}
