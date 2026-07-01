import type { AgentMode, RoutedIntent } from "../../shared/types";

export const agentModes: Array<{
  id: AgentMode;
  title: string;
  description: string;
}> = [
  { id: "auto", title: "Auto", description: "Kamiya selects the best operating mode for the request." },
  { id: "planner", title: "Planner", description: "Break goals into milestones, tasks, and missing decisions." },
  { id: "builder", title: "Builder", description: "Create implementation artifacts and prepare build workflows." },
  { id: "reviewer", title: "Reviewer", description: "Review submissions, PRs, and validation reports." },
  { id: "automator", title: "Automator", description: "Queue auditable workflows, reminders, and background jobs." },
  { id: "manager", title: "Manager", description: "Track progress, deadlines, assignments, and blockers." },
  { id: "coach", title: "Coach", description: "Suggest skills, learning paths, and next quests." }
];

export function parseModeCommand(message: string): AgentMode | undefined {
  const match = message.trim().toLowerCase().match(/^\/mode(?:\s+(\w+))?/);
  const requested = match?.[1] as AgentMode | undefined;
  if (!requested) return undefined;
  return agentModes.some((mode) => mode.id === requested) ? requested : undefined;
}

export function shouldShowModes(message: string): boolean {
  return /^\/mode\s*$/i.test(message.trim()) || /\b(agent modes?|switch modes?|kamiya modes?)\b/i.test(message);
}

export function selectAutoMode(intent: RoutedIntent): AgentMode {
  if (intent.intent === "planning") return "planner";
  if (intent.intent === "automation") return "automator";
  if (intent.intent === "task_submission") return "reviewer";
  if (intent.intent === "task_management" || intent.intent === "statistics") return "manager";
  if (intent.intent === "knowledge") return "coach";
  return "auto";
}
