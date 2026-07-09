import type { ActionPreview, AutomationWorkflowKind, PlanningDraft, RoutedIntent } from "../../shared/types";

export function previewProjectCreation(draft: PlanningDraft): ActionPreview {
  const tags = normalizeTags(draft);
  const name = limitText(draft.title ?? "Untitled quest", 100);
  const description = draft.mission ?? draft.title ?? "Created through Kamiya.";
  const outcomeStatement = draft.desiredOutcome ?? description;

  return {
    id: crypto.randomUUID(),
    kind: "create_project",
    title: `Create project: ${name}`,
    summary: `Kamiya will ask Cerbanimo to prepare a durable projects.bootstrap action for "${name}", then generate a project plan, map the task graph, validate dependencies, commit the project, and activate the first tasks after you confirm.`,
    risk: "low",
    destructive: false,
    payload: {
      name,
      description,
      outcomeStatement,
      tags,
      dueDate: normalizeDueDate(draft.timeline),
      auto_assign: false,
      is_service: false,
      service_visibility: ["private"],
      service_price: 0,
      generationMode: "plan_then_tasks",
      audience: draft.audience,
      constraints: draft.constraints,
      successCriteria: draft.successCriteria
    },
    requiredPermissions: ["projects:create"],
    createdAt: new Date().toISOString(),
    functionName: "projects.bootstrap"
  };
}

function normalizeTags(draft: PlanningDraft): string[] {
  const values = [...(draft.tags ?? []), draft.audience, draft.successCriteria]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[,;]/g))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 48);

  return [...new Set(values)].slice(0, 8);
}

function limitText(value: string, maxLength: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeDueDate(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value : null;
}

export function previewAutomation(intent: RoutedIntent, message: string): ActionPreview {
  const workflowType = detectAutomationWorkflow(message);
  const permissions = permissionsForWorkflow(workflowType);

  return {
    id: crypto.randomUUID(),
    kind: "run_automation",
    title: `Queue automation: ${humanizeWorkflow(workflowType)}`,
    summary: summaryForWorkflow(workflowType),
    risk: riskForWorkflow(workflowType),
    destructive: workflowType === "deploy_staging" || workflowType === "generate_pull_request",
    payload: {
      workflowType,
      request: message,
      entities: intent.entities,
      audit: {
        requiresPreview: true,
        requiresConfirmation: true,
        logIntent: true,
        notifyOnCompletion: true
      }
    },
    requiredPermissions: permissions,
    createdAt: new Date().toISOString()
  };
}

export function detectAutomationWorkflow(message: string): AutomationWorkflowKind {
  const lower = message.toLowerCase();
  if (/\bcompetitor|market research|research\b/.test(lower)) return "research_competitors";
  if (/\bsummarize|summary|document|docs?\b/.test(lower)) return "summarize_documents";
  if (/\bproject plan|implementation plan|milestones?\b/.test(lower)) return "generate_project_plan";
  if (/\bgithub issues?|issues?\b/.test(lower)) return "create_github_issues";
  if (/\bpull request|pr\b/.test(lower)) return "generate_pull_request";
  if (/\bdeploy|staging\b/.test(lower)) return "deploy_staging";
  if (/\bdeadline|due date|monitor\b/.test(lower)) return "monitor_deadlines";
  if (/\bblocked|blocker|stuck\b/.test(lower)) return "detect_blockers";
  if (/\bremind|reminder|schedule\b/.test(lower)) return "schedule_reminder";
  if (/\bvalidate|verification|submitted work|submission\b/.test(lower)) return "validate_submission";
  if (/\breview.*pull request|review.*pr|code review\b/.test(lower)) return "review_pull_request";
  if (/\bquality|checks?|test|lint\b/.test(lower)) return "run_quality_checks";
  return "custom";
}

function permissionsForWorkflow(workflowType: AutomationWorkflowKind): string[] {
  const base = ["automation:create"];
  if (workflowType === "create_github_issues" || workflowType === "generate_pull_request" || workflowType === "review_pull_request") {
    return [...base, "integrations:github"];
  }
  if (workflowType === "deploy_staging") return [...base, "deployments:create"];
  if (workflowType === "validate_submission") return [...base, "tasks:review"];
  return base;
}

function riskForWorkflow(workflowType: AutomationWorkflowKind): ActionPreview["risk"] {
  if (workflowType === "deploy_staging" || workflowType === "generate_pull_request") return "high";
  if (workflowType === "create_github_issues" || workflowType === "review_pull_request" || workflowType === "validate_submission") return "medium";
  return "low";
}

function summaryForWorkflow(workflowType: AutomationWorkflowKind): string {
  const summaries: Record<AutomationWorkflowKind, string> = {
    research_competitors: "Cerbanimo will create an auditable research workflow and return sourced findings.",
    summarize_documents: "Cerbanimo will summarize provided documents and attach the result to the relevant work context.",
    generate_project_plan: "Cerbanimo will generate milestones and implementation tasks for review.",
    create_github_issues: "Cerbanimo will draft GitHub issues from the approved task plan.",
    generate_pull_request: "Cerbanimo will prepare a pull request workflow and require review before merge-sensitive steps.",
    deploy_staging: "Cerbanimo will trigger a staging deployment workflow with audit logging.",
    monitor_deadlines: "Cerbanimo will monitor deadlines and notify responsible people when risk changes.",
    detect_blockers: "Cerbanimo will scan project/task state for blockers and propose interventions.",
    schedule_reminder: "Cerbanimo will create a scheduled reminder action.",
    validate_submission: "Cerbanimo will validate submitted work against task requirements and proof.",
    review_pull_request: "Cerbanimo will review a pull request and produce actionable findings.",
    run_quality_checks: "Cerbanimo will run quality checks and summarize failures or next steps.",
    custom: "Cerbanimo will create a custom auditable automation workflow for this request."
  };
  return summaries[workflowType];
}

function humanizeWorkflow(workflowType: AutomationWorkflowKind): string {
  return workflowType.replace(/_/g, " ");
}
