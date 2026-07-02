import type { ActionExecutionRecord, ActionPreview, PlanningDraft, ResponseCard } from "../../shared/types";
import { agentModes } from "./modeService";

export function actionPreviewCard(action: ActionPreview): ResponseCard {
  return {
    id: `card-${action.id}`,
    kind: "action_preview",
    title: action.title,
    subtitle: `${action.risk.toUpperCase()} risk${action.destructive ? " destructive" : ""}`,
    body: action.summary,
    metadata: {
      permissions: action.requiredPermissions,
      createdAt: action.createdAt
    },
    actions: [
      { id: "confirm", label: "Confirm", style: "primary", actionId: action.id },
      { id: "cancel", label: "Cancel", style: "secondary", command: "cancel" }
    ]
  };
}

export function retryProjectActionCard(action: ActionPreview): ResponseCard {
  return {
    id: `retry-${action.id}`,
    kind: "action_preview",
    title: "Retry project task generation",
    subtitle: "Cerbanimo did not return active tasks in time",
    body: action.summary,
    metadata: {
      project: String(action.payload.name ?? "Untitled quest"),
      createdAt: action.createdAt
    },
    actions: [
      { id: "confirm", label: "Retry", style: "primary", actionId: action.id },
      { id: "cancel", label: "Cancel", style: "secondary", command: "cancel" }
    ]
  };
}

export function projectProcessingCard(data: Record<string, unknown>): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "timeline",
    title: "Project processing",
    subtitle: String(data.status ?? "waiting"),
    body: String(data.message ?? "Kamiya is waiting for Cerbanimo to generate and activate tasks."),
    metadata: {
      projectId: String(data.projectId ?? ""),
      elapsedMs: String(data.elapsedMs ?? 0)
    }
  };
}

export function questSummaryCard(draft: PlanningDraft): ResponseCard {
  const metadata = compactMetadata({
    desiredOutcome: draft.desiredOutcome ?? "",
    deadline: draft.timeline ?? "",
    constraints: draft.constraints ?? ""
  } as NonNullable<ResponseCard["metadata"]>);

  return {
    id: crypto.randomUUID(),
    kind: "quest_summary",
    title: draft.title ?? "New quest",
    subtitle: draft.timeline,
    body: draft.mission,
    metadata
  };
}

export function searchResultsCard(items: Array<Record<string, unknown>>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "search_results",
    title: mocked ? "Search results (mocked)" : "Search results",
    subtitle: `${items.length} result${items.length === 1 ? "" : "s"}`,
    items: items.map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? item.name ?? "Untitled"),
      subtitle: String(item.type ?? "Cerbanimo item"),
      status: String(item.status ?? "available")
    }))
  };
}

export function taskListCard(items: Array<Record<string, unknown>>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "task",
    title: mocked ? "Tasks (mocked)" : "Tasks",
    subtitle: `${items.length} task${items.length === 1 ? "" : "s"}`,
    items: items.map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? item.name ?? "Untitled task"),
      subtitle: String(item.project ?? item.project_name ?? item.type ?? "Cerbanimo task"),
      status: String(item.status ?? "open"),
      metadata: {
        reward: typeof item.reward === "number" ? item.reward : typeof item.reward_tokens === "number" ? item.reward_tokens : 0
      }
    })),
    actions: [
      { id: "search-open-tasks", label: "Open tasks", style: "secondary", command: "/search open tasks" },
      { id: "submit-work", label: "Submit work", style: "primary", command: "/submit " }
    ]
  };
}

export function profileCard(data: Record<string, unknown>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "profile",
    title: String(data.displayName ?? "Your profile"),
    subtitle: mocked ? "Profile summary (mocked)" : "Profile summary",
    metadata: {
      title: String(data.title ?? "Contributor"),
      level: String(data.level ?? ""),
      skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
      activeProjects: String(data.activeProjects ?? ""),
      completedTasks: String(data.completedTasks ?? ""),
      tokens: String(data.tokens ?? "")
    },
    actions: [{ id: "profile-stats", label: "Show stats", style: "primary", command: "/stats" }]
  };
}

export function notificationCard(items: Array<Record<string, unknown>>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "approval",
    title: mocked ? "Notifications (mocked)" : "Notifications",
    subtitle: "Progress and approval updates",
    items: items.map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? "Notification"),
      subtitle: String(item.body ?? ""),
      status: String(item.status ?? "new")
    }))
  };
}

export function automationTemplatesCard(items: Array<Record<string, unknown>>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "automation",
    title: mocked ? "Automation templates (mocked)" : "Automation templates",
    subtitle: "Auditable workflows Kamiya can preview",
    items: items.map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? "Automation"),
      subtitle: String(item.permission ?? "automation:create"),
      status: String(item.status ?? "available")
    })),
    actions: [
      { id: "quality-checks", label: "Quality checks", style: "secondary", command: "/automation run quality checks" },
      { id: "github-issues", label: "GitHub issues", style: "secondary", command: "/automation create GitHub issues" }
    ]
  };
}

export function actionQueueCard(items: Array<Record<string, unknown> | ActionExecutionRecord>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "action_queue",
    title: mocked ? "Action queue (mocked)" : "Action queue",
    subtitle: "Auditable automation and mutation history",
    items: items.map((item) => ({
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? "Action"),
      subtitle: String(item.summary ?? item.kind ?? "Queued Cerbanimo action"),
      status: String(item.status ?? "queued")
    }))
  };
}

export function validationReportCard(data: Record<string, unknown>, mocked?: boolean): ResponseCard {
  const checks = Array.isArray(data.checks) ? (data.checks as Array<Record<string, unknown>>) : [];

  return {
    id: crypto.randomUUID(),
    kind: "validation_report",
    title: mocked ? `${String(data.title ?? "Validation report")} (mocked)` : String(data.title ?? "Validation report"),
    subtitle: String(data.target ?? "Submission validation"),
    metadata: {
      status: String(data.status ?? "ready")
    },
    items: checks.map((check) => ({
      id: String(check.id ?? crypto.randomUUID()),
      title: String(check.title ?? "Check"),
      status: String(check.status ?? "queued")
    })),
    actions: [{ id: "queue-validation", label: "Queue validation", style: "primary", command: "/automation validate latest submission" }]
  };
}

export function modeCard(activeMode: string): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "mode",
    title: "Kamiya modes",
    subtitle: `Active mode: ${activeMode}`,
    body: "Modes share the same Cerbanimo memory and permissions. Auto lets Kamiya choose the best mode per request.",
    items: agentModes.map((mode) => ({
      id: mode.id,
      title: mode.title,
      subtitle: mode.description,
      status: mode.id === activeMode ? "active" : "available"
    })),
    actions: [
      { id: "planner", label: "Planner", style: "secondary", command: "/mode planner" },
      { id: "automator", label: "Automator", style: "secondary", command: "/mode automator" },
      { id: "auto", label: "Auto", style: "primary", command: "/mode auto" }
    ]
  };
}

export function integrationCard(): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "integration",
    title: "Phase 4 clients",
    subtitle: "Web, Discord, Slack, Google Chat, voice, and SDK",
    body: "Every client should call the same Kamiya chat-turn contract and render the shared card schema in its native format.",
    items: [
      { id: "web", title: "Web", subtitle: "React chat UI", status: "active" },
      { id: "discord", title: "Discord", subtitle: "Webhook endpoint scaffold", status: "ready for bot token wiring" },
      { id: "slack", title: "Slack", subtitle: "Webhook endpoint scaffold", status: "ready for app signing" },
      { id: "google_chat", title: "Google Chat", subtitle: "Webhook endpoint scaffold", status: "ready for card mapping" },
      { id: "voice", title: "Voice", subtitle: "Channel contract only", status: "platform pending" },
      { id: "sdk", title: "Public SDK", subtitle: "Shared TypeScript client export", status: "scaffolded" }
    ]
  };
}

export function navigationCard(data: Record<string, unknown>, mocked?: boolean): ResponseCard {
  const title = String(data.title ?? "Open Cerbanimo view");
  const url = String(data.url ?? "");

  return {
    id: crypto.randomUUID(),
    kind: "project",
    title: mocked ? `${title} (mocked)` : title,
    subtitle: String(data.type ?? "navigation"),
    body: "Cerbanimo should eventually return a render descriptor for this page. Kamiya can display the card now and deep-link when available.",
    metadata: {
      target: String(data.target ?? ""),
      url
    },
    actions: url ? [{ id: "open-target", label: "Open", style: "primary", command: `/open ${url}` }] : undefined
  };
}

export function statsCard(data: Record<string, unknown>, mocked?: boolean): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "stats",
    title: mocked ? "Your stats (mocked)" : "Your stats",
    subtitle: "Generated by Cerbanimo application logic",
    metadata: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)])
    )
  };
}

export function helpCard(): ResponseCard {
  return {
    id: crypto.randomUUID(),
    kind: "help",
    title: "Kamiya commands",
    body: "Use slash commands to route quickly, or describe your goal naturally.",
    items: [
      { id: "/plan", title: "/plan", subtitle: "Turn an idea into a quest." },
      { id: "/submit", title: "/submit", subtitle: "Submit task proof." },
      { id: "/search", title: "/search", subtitle: "Find tasks, projects, communities, users, or skills." },
      { id: "/automation", title: "/automation", subtitle: "Preview an auditable workflow." }
    ]
  };
}

function compactMetadata(metadata: NonNullable<ResponseCard["metadata"]>): ResponseCard["metadata"] | undefined {
  const entries = Object.entries(metadata).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim().length > 0;
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}
