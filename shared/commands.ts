import type { SlashCommand } from "./types";

export const slashCommands: SlashCommand[] = [
  { name: "/plan", label: "Plan a quest", intent: "planning", description: "Refine an idea into a Cerbanimo project." },
  { name: "/create", label: "Create", intent: "administration", description: "Create a project, task, or community item." },
  { name: "/project", label: "Project", intent: "navigation", description: "Open or summarize a project." },
  { name: "/task", label: "Task", intent: "task_management", description: "Find, claim, update, or review tasks." },
  { name: "/submit", label: "Submit work", intent: "task_submission", description: "Submit proof for a completed task." },
  { name: "/community", label: "Community", intent: "community", description: "Browse, join, or inspect communities." },
  { name: "/search", label: "Search", intent: "search", description: "Search projects, tasks, people, skills, or communities." },
  { name: "/profile", label: "Profile", intent: "navigation", description: "Show a profile summary." },
  { name: "/stats", label: "Stats", intent: "statistics", description: "Show progress, rankings, tokens, or streaks." },
  { name: "/open", label: "Open", intent: "navigation", description: "Open a Cerbanimo page or view." },
  { name: "/help", label: "Help", intent: "knowledge", description: "Ask how Cerbanimo or Kamiya works." },
  { name: "/automation", label: "Automation", intent: "automation", description: "Preview or run auditable workflows." },
  { name: "/mode", label: "Agent mode", intent: "settings", description: "Switch Kamiya modes: planner, builder, reviewer, automator, manager, or coach." },
  { name: "/settings", label: "Settings", intent: "settings", description: "Configure Cerbanimo API access." }
];

export function matchSlashCommand(input: string): SlashCommand | undefined {
  const token = input.trim().split(/\s+/)[0].toLowerCase();
  return slashCommands.find((command) => command.name === token);
}

export function suggestSlashCommands(input: string): SlashCommand[] {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return [];
  const token = trimmed.split(/\s+/)[0].toLowerCase();
  return slashCommands.filter((command) => command.name.startsWith(token));
}
