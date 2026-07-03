import type {
  ActionExecutionRecord,
  ActionPreview,
  CerbanimoTask,
  PlanningDraft,
  ProjectBootstrapActionDetail,
  ResponseCard
} from "../../shared/types";
import { agentModes } from "./modeService";

export function actionPreviewCard(action: ActionPreview): ResponseCard {
  const tags = Array.isArray(action.payload.tags) ? action.payload.tags.map(String) : [];
  const dueDate = action.payload.dueDate ?? action.payload.due_date;
  const projectName = String(action.payload.name ?? action.title.replace(/^Create project:\s*/i, ""));
  const description = String(action.payload.description ?? "");
  const outcome = String(action.payload.outcomeStatement ?? "");
  const durableActionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
  const actionId = durableActionId ?? action.id;

  return {
    id: `card-${action.id}`,
    kind: "action_preview",
    title: `Create project: ${projectName}`,
    subtitle: `${action.risk.toUpperCase()} risk${action.destructive ? " destructive" : ""}`,
    body: [
      description,
      outcome ? `Outcome: ${outcome}` : "",
      "After confirmation, Cerbanimo will generate a project plan, create and validate a task graph, persist the project atomically, and activate the first available tasks."
    ].filter(Boolean).join("\n\n"),
    metadata: {
      status: action.cerbanimoActionId ? "previewed in Cerbanimo" : "local preview",
      dueDate: String(dueDate ?? "No deadline"),
      tags,
      permissions: action.requiredPermissions,
      confirmationStatus: "awaiting explicit confirmation",
      actionId,
      createdAt: action.createdAt
    },
    actions: [
      { id: "confirm", label: "Confirm quest creation", style: "primary", actionId: action.cerbanimoActionId ?? action.id },
      { id: "cancel", label: "Cancel quest creation", style: "secondary", command: durableActionId ? `cancel action ${actionId}` : "cancel", actionId }
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

export function workflowProgressCard(detail: ProjectBootstrapActionDetail, requestId?: string): ResponseCard {
  const workflowStatus = String(detail.workflow?.status ?? detail.action.status ?? "previewed");
  const completedSteps = new Set(detail.steps.filter((step) => step.status === "completed" || step.status === "skipped").map((step) => step.step_name));
  const runningStep = detail.steps.find((step) => step.status === "running")?.step_name;
  const failedStep = detail.steps.find((step) => step.status === "failed")?.step_name;
  const currentStage = failedStep ?? runningStep ?? nextIncompleteStage(completedSteps) ?? "finalizeAction";

  return {
    id: `workflow-${detail.action.id}`,
    kind: "workflow_progress",
    title: "Quest creation progress",
    subtitle: humanWorkflowStatus(workflowStatus),
    body: workflowStatus === "retry_wait"
      ? "Cerbanimo hit a retryable problem. Your confirmed quest is safe and no duplicate project was created; Cerbanimo will retry automatically."
      : "Cerbanimo is preparing the project through the durable bootstrap workflow.",
    metadata: {
      actionId: String(detail.action.action_uuid ?? detail.action.id),
      workflowRunId: detail.workflow?.id ? String(detail.workflow.id) : "",
      currentStage: stageLabel(currentStage),
      attempt: String(detail.workflow?.attempt_count ?? 0),
      requestId: requestId ?? ""
    },
    items: bootstrapStages.map((stage) => ({
      id: stage.name,
      title: stage.label,
      status: stage.name === currentStage && !completedSteps.has(stage.name)
        ? workflowStatus === "retry_wait" ? "retrying" : "in progress"
        : completedSteps.has(stage.name) ? "complete" : "pending"
    })),
    actions: cancellableStatuses.has(workflowStatus)
      ? [{ id: "cancel-quest", label: "Cancel quest creation", style: "secondary", command: `cancel action ${detail.action.action_uuid ?? detail.action.id}` }]
      : undefined
  };
}

export function workflowFailureCard(detail: ProjectBootstrapActionDetail, requestId?: string): ResponseCard {
  const error = normalizeError(detail.error ?? detail.workflow?.last_error ?? detail.action.execution_result);
  const status = String(detail.workflow?.status ?? detail.action.status);
  const retryable = Boolean(error.retryable || status === "retry_wait" || status === "blocked" || status === "failed");

  return {
    id: `workflow-failure-${detail.action.id}`,
    kind: "workflow_failure",
    title: status === "cancelled" ? "Quest creation cancelled" : "Quest creation needs attention",
    subtitle: humanWorkflowStatus(status),
    body: status === "cancelled"
      ? "Quest creation was cancelled before the project was committed."
      : error.message || "Cerbanimo could not finish preparing this quest.",
    metadata: {
      code: String(error.code ?? status),
      failedStage: String(error.stage ?? failedStage(detail) ?? "unknown"),
      retryable: retryable ? "yes" : "no",
      attempt: String(detail.workflow?.attempt_count ?? 0),
      actionId: String(detail.action.action_uuid ?? detail.action.id),
      requestId: requestId ?? ""
    },
    actions: [
      ...(retryable ? [{ id: "retry-quest", label: "Retry quest creation", style: "primary" as const, command: `retry action ${detail.action.action_uuid ?? detail.action.id}` }] : []),
      ...(cancellableStatuses.has(status) ? [{ id: "cancel-quest", label: "Cancel quest creation", style: "secondary" as const, command: `cancel action ${detail.action.action_uuid ?? detail.action.id}` }] : [])
    ]
  };
}

export function projectResultCards(detail: ProjectBootstrapActionDetail): ResponseCard[] {
  const project = detail.project;
  if (!project) return [workflowProgressCard(detail)];

  const projectTitle = String(project.name ?? project.title ?? "Created project");
  const dueDate = project.due_date ?? project.dueDate;
  return [
    {
      id: `project-${project.id}`,
      kind: "project",
      title: projectTitle,
      subtitle: "Created in Cerbanimo",
      body: String(project.description ?? ""),
      metadata: {
        dueDate: dueDate ? String(dueDate) : "No deadline",
        totalTasks: detail.tasks.length,
        activeTasks: detail.activeTasks.length
      },
      actions: [
        { id: "open-created-project", label: "Open created project", style: "primary", command: `/open /projects/${project.id}` },
        { id: "explore-active-tasks", label: "Explore active tasks", style: "secondary", command: `explore active tasks ${project.id}` }
      ]
    },
    activeTaskCard(detail.activeTasks)
  ];
}

export function activeTaskCard(tasks: CerbanimoTask[]): ResponseCard {
  const counts = classificationCounts(tasks);
  const assistedTask = tasks.find((task) => task.automation?.classification === "assisted_automation");
  return {
    id: crypto.randomUUID(),
    kind: "task",
    title: "Active root tasks",
    subtitle: `${tasks.length} active task${tasks.length === 1 ? "" : "s"}`,
    body: [
      "These tasks are active now because their dependencies are clear.",
      classificationNarrative(counts)
    ].join("\n\n"),
    metadata: {
      humanTasks: counts.human_driven,
      assistedTasks: counts.assisted_automation,
      automationReadyClassifications: counts.fully_automatable
    },
    items: tasks.map((task) => ({
      id: String(task.id),
      title: String(task.name ?? task.title ?? "Untitled task"),
      subtitle: taskSubtitle(task),
      status: automationLabel(task),
      metadata: {
        taskStatus: String(task.status ?? "active"),
        classification: automationLabel(task),
        automationSummary: automationSummary(task),
        requiredInputs: requiredInputSummary(task),
        requiredCapability: capabilitySummary(task),
        expectedArtifact: artifactSummary(task),
        validation: validationSummary(task),
        skill: String(task.skill_name ?? "Unspecified"),
        skillLevel: Number(task.skill_level ?? 0),
        rewardTokens: Number(task.reward_tokens ?? 0),
        dueDate: String(task.due_date ?? "none"),
        dependencies: dependencySummary(task.dependencies)
      }
    })),
    actions: assistedTask
      ? [{ id: "view-required-inputs", label: "View required inputs", style: "secondary", command: `view required inputs ${assistedTask.id}` }]
      : undefined
  };
}

export function assistedTaskInputsCard(tasks: CerbanimoTask[], taskId?: string): ResponseCard {
  const task = tasks.find((item) => String(item.id) === String(taskId))
    ?? tasks.find((item) => item.automation?.classification === "assisted_automation");
  const inputs = task?.automation?.requiredHumanInputs ?? [];

  return {
    id: crypto.randomUUID(),
    kind: "task",
    title: task ? `Required inputs: ${String(task.name ?? "Assisted task")}` : "Required inputs",
    subtitle: "Read-only assisted automation preparation",
    body: task
      ? "Kamiya can help prepare this task after these inputs and permissions are supplied. Execution is not enabled in this release."
      : "Cerbanimo did not return an assisted task with input requirements.",
    metadata: {
      classification: task ? automationLabel(task) : "Human task",
      requiredInputs: inputs.length,
      requiredCapability: task ? capabilitySummary(task) : "none",
      expectedArtifact: task ? artifactSummary(task) : "none"
    },
    items: inputs.map((input) => ({
      id: input.key,
      title: input.label,
      subtitle: input.description || input.inputType,
      status: input.required ? "required" : "optional",
      metadata: {
        key: input.key,
        inputType: input.inputType,
        sensitive: input.sensitive ? "yes" : "no"
      }
    }))
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

const bootstrapStages = [
  { name: "validateInput", label: "Validating your quest" },
  { name: "generateProjectPlan", label: "Designing the project plan" },
  { name: "generateTaskGraph", label: "Mapping the task graph" },
  { name: "validateTaskGraph", label: "Checking dependencies and dates" },
  { name: "persistProjectGraph", label: "Committing the project" },
  { name: "activateRootTasks", label: "Activating the first tasks" },
  { name: "finalizeAction", label: "Preparing your quest dashboard" }
];

const cancellableStatuses = new Set(["previewed", "confirmed", "queued", "running", "retry_wait"]);

function nextIncompleteStage(completedSteps: Set<string>): string | undefined {
  return bootstrapStages.find((stage) => !completedSteps.has(stage.name))?.name;
}

function stageLabel(stageName: string): string {
  return bootstrapStages.find((stage) => stage.name === stageName)?.label ?? stageName;
}

function humanWorkflowStatus(status: string): string {
  const labels: Record<string, string> = {
    previewed: "Awaiting confirmation",
    confirmed: "Queued",
    queued: "Queued",
    running: "In progress",
    retry_wait: "Retrying",
    blocked: "Blocked",
    failed: "Failed",
    completed: "Completed",
    executed: "Completed",
    cancelled: "Cancelled"
  };
  return labels[status] ?? "State needs reconciliation";
}

function failedStage(detail: ProjectBootstrapActionDetail): string | undefined {
  return detail.steps.find((step) => step.status === "failed")?.step_name;
}

function normalizeError(error: unknown): { code?: string | number; message?: string; stage?: string; retryable?: boolean } {
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" || typeof record.code === "number" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      stage: typeof record.stage === "string" ? record.stage : undefined,
      retryable: typeof record.retryable === "boolean" ? record.retryable : undefined
    };
  }
  return { message: typeof error === "string" ? error : undefined };
}

function dependencySummary(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "none";
  return `${value.length} dependenc${value.length === 1 ? "y" : "ies"}`;
}

function classificationCounts(tasks: CerbanimoTask[]): Record<"human_driven" | "assisted_automation" | "fully_automatable", number> {
  return tasks.reduce((counts, task) => {
    const classification = task.automation?.classification ?? "human_driven";
    counts[classification] += 1;
    return counts;
  }, { human_driven: 0, assisted_automation: 0, fully_automatable: 0 });
}

function classificationNarrative(counts: Record<"human_driven" | "assisted_automation" | "fully_automatable", number>): string {
  const pieces = [];
  if (counts.human_driven > 0) pieces.push(`${counts.human_driven} need human participation or judgment`);
  if (counts.assisted_automation > 0) pieces.push(`${counts.assisted_automation} can be prepared for assisted automation after inputs are supplied`);
  if (counts.fully_automatable > 0) pieces.push(`${counts.fully_automatable} are classified as suitable for bounded automation once execution capability is connected`);
  return pieces.length ? `Your first tasks are active: ${pieces.join("; ")}.` : "Your first tasks are active.";
}

function automationLabel(task: CerbanimoTask): string {
  const classification = task.automation?.classification ?? "human_driven";
  if (classification === "assisted_automation") return "Automation-assisted";
  if (classification === "fully_automatable") return "Automation-ready classification";
  return "Human task";
}

function automationSummary(task: CerbanimoTask): string {
  const automation = task.automation;
  if (!automation || automation.source === "legacy_default") {
    return "This task predates automation classification and defaults to human execution.";
  }
  if (automation.classification === "assisted_automation") {
    return `Kamiya can help after the required inputs and permissions are supplied. ${requiredInputSummary(task)}.`;
  }
  if (automation.classification === "fully_automatable") {
    return "This task has enough context for bounded automation. Execution capability has not been connected yet.";
  }
  return "This work needs a person's judgment, participation, or physical action.";
}

function taskSubtitle(task: CerbanimoTask): string {
  const description = String(task.description ?? task.skill_name ?? "Cerbanimo task");
  return `${description} ${automationLabel(task)}.`;
}

function requiredInputSummary(task: CerbanimoTask): string {
  const inputs = task.automation?.requiredHumanInputs ?? [];
  if (inputs.length === 0) return "No required human inputs";
  return `Needs ${inputs.length} input${inputs.length === 1 ? "" : "s"}: ${inputs.slice(0, 3).map((input) => input.label).join(", ")}${inputs.length > 3 ? ", ..." : ""}`;
}

function capabilitySummary(task: CerbanimoTask): string {
  const capabilities = task.automation?.requirements?.capabilities ?? [];
  return capabilities.length ? capabilities.join(", ") : "Execution capability not connected yet";
}

function artifactSummary(task: CerbanimoTask): string {
  const artifacts = task.automation?.requirements?.expectedArtifacts ?? [];
  return artifacts.length ? artifacts.join(", ") : "none";
}

function validationSummary(task: CerbanimoTask): string {
  const validation = task.automation?.validationRequirements ?? [];
  if (validation.length === 0) return "No validation requirements listed";
  return validation.slice(0, 2).map((item) => item.description || item.requirementId).join("; ");
}
