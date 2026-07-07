import { matchSlashCommand } from "../../shared/commands";
import type { RoutedIntent } from "../../shared/types";

export function routeIntentLocally(message: string): RoutedIntent {
  const lower = message.toLowerCase();
  const slash = matchSlashCommand(message);

  if (slash) {
    return {
      reasoning: `Matched slash command ${slash.name}.`,
      intent: slash.intent,
      confidence: 0.92,
      entities: { command: slash.name },
      required_inputs: [],
      next_action:
        slash.name === "/settings"
          ? "show_settings"
          : slash.name === "/mode"
            ? "show_modes"
          : slash.name === "/help"
            ? "show_help"
            : slash.name === "/stats"
              ? "show_stats"
              : slash.name === "/search" || slash.name === "/community"
                ? "search_cerbanimo"
                : slash.name === "/task"
                  ? "show_tasks"
                  : slash.name === "/profile"
                    ? "show_profile"
                : slash.name === "/open" || slash.name === "/project"
                  ? "open_page"
                  : slash.name === "/automation"
                    ? "queue_automation"
                    : slash.name === "/submit"
                      ? "submit_task"
                      : slash.name === "/plan" || slash.name === "/create"
                        ? "ask_missing_inputs"
                        : "respond"
    };
  }

  if (
    /\b(plan|create project|new project|start project|create a project|quest|project idea|turn .* into|roadmap|milestone)\b/.test(lower) ||
    /\b(i\s+want\s+to|we\s+want\s+to|help\s+me)\s+(create|build|design|launch|start|make)\b/.test(lower) ||
    /\b(create|build|design|launch|start)\s+(a|an|the)\s+.+\b(system|platform|community|project|program|initiative|tool)\b/.test(lower)
  ) {
    return {
      reasoning: "User appears to be refining or creating a project.",
      intent: "planning",
      confidence: 0.86,
      entities: {},
      required_inputs: [],
      next_action: "ask_missing_inputs"
    };
  }

  if (/\b(submit|proof|completed|done|finished)\b/.test(lower)) {
    return {
      reasoning: "User is trying to submit or complete work.",
      intent: "task_submission",
      confidence: 0.84,
      entities: {},
      required_inputs: [
        { field: "task", status: lower.includes("task") ? "fulfilled" : "missing", question: "Which task should I submit?" },
        { field: "proof", status: lower.includes("http") || lower.includes("proof") ? "fulfilled" : "missing", question: "What proof should I attach?" }
      ],
      next_action: "submit_task"
    };
  }

  if (/\b(task|tasks|assigned|claim|blocked|review)\b/.test(lower)) {
    return {
      reasoning: "User is asking about task management.",
      intent: "task_management",
      confidence: 0.8,
      entities: { query: message },
      required_inputs: [],
      next_action: "show_tasks"
    };
  }

  if (/\b(profile|my account|my contributions|who am i)\b/.test(lower)) {
    return {
      reasoning: "User wants a profile summary.",
      intent: "navigation",
      confidence: 0.78,
      entities: {},
      required_inputs: [],
      next_action: "show_profile"
    };
  }

  if (/\b(search|find|browse|nearby|matching|recommended)\b/.test(lower)) {
    return {
      reasoning: "User is searching Cerbanimo resources.",
      intent: "search",
      confidence: 0.82,
      entities: { query: message },
      required_inputs: [],
      next_action: "search_cerbanimo"
    };
  }

  if (/\b(stats|level|tokens|leaderboard|ranking|progress|streak)\b/.test(lower)) {
    return {
      reasoning: "User is asking for platform statistics.",
      intent: "statistics",
      confidence: 0.84,
      entities: {},
      required_inputs: [],
      next_action: "show_stats"
    };
  }

  if (/\b(automate|schedule|remind|workflow|deploy|github issue|pull request)\b/.test(lower)) {
    return {
      reasoning: "User wants an automation or scheduled workflow.",
      intent: "automation",
      confidence: 0.8,
      entities: { request: message },
      required_inputs: [],
      next_action: "queue_automation"
    };
  }

  if (/\b(agent modes?|switch modes?|kamiya modes?)\b/.test(lower)) {
    return {
      reasoning: "User wants to inspect or switch Kamiya operating modes.",
      intent: "settings",
      confidence: 0.82,
      entities: {},
      required_inputs: [],
      next_action: "show_modes"
    };
  }

  if (/\b(open|show|go to|navigate)\b/.test(lower)) {
    return {
      reasoning: "User wants navigation or rendering.",
      intent: "navigation",
      confidence: 0.78,
      entities: { target: message },
      required_inputs: [],
      next_action: "open_page"
    };
  }

  return {
    reasoning: "General conversational or help-like message.",
    intent: "conversation",
    confidence: 0.66,
    entities: {},
    required_inputs: [],
    next_action: "respond"
  };
}
