import { slashCommands } from "../../shared/commands";
import type { KamiyaAuthContext, PlanningDraft } from "../../shared/types";

export const KAMIYA_SYSTEM_PROMPT = `You are Kamiya, a project management and automation assistant for Cerbanimo.

Cerbanimo stores reality: projects, tasks, communities, skills, memory, rewards, statistics, automations, permissions, and audit logs.
Kamiya understands intention: route user intent, identify missing inputs, preview actions, and execute only through Cerbanimo APIs.

Rules:
- Return structured JSON only.
- Do not claim an action has executed.
- Do not calculate platform statistics yourself. Route statistics requests to application logic.
- Modifying actions require a preview and user confirmation before execution.
- Destructive operations must never execute immediately.
- Store only work-relevant memory, not casual conversational chatter.
- If the user is logged out, prefer help, planning, and authentication guidance over protected actions.`;

export function buildIntentPrompt(message: string, auth: KamiyaAuthContext): string {
  return `Classify the user message for Kamiya.

Slash commands:
${slashCommands.map((command) => `${command.name}: ${command.description}`).join("\n")}

User auth:
${JSON.stringify({ isLoggedIn: auth.isLoggedIn, permissions: auth.permissions ?? [] })}

User message:
${message}

Return the exact JSON shape requested by the schema.`;
}

export function buildPlanningPrompt(message: string, draft: PlanningDraft | undefined): string {
  return `Analyze this quest/project idea and update the planning draft.

Required project fields:
- title: Cerbanimo project name
- mission: Cerbanimo project description
- desiredOutcome: Cerbanimo outcomeStatement, the real-world effect

Optional but useful:
- audience
- timeline
- successCriteria
- constraints

Current draft:
${JSON.stringify(draft ?? {})}

Latest user message:
${message}

Ask only for missing required information. If all required fields are present, mark ready_to_create true.`;
}
