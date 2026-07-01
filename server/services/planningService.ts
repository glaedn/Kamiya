import type { PlanningAnalysis, PlanningDraft } from "../../shared/types";
import { planningResponseSchema } from "../ai/jsonSchemas";
import { generateGeminiJson } from "../ai/geminiClient";
import { buildPlanningPrompt } from "../ai/prompts";

const requiredFields: Array<keyof PlanningDraft> = [
  "title",
  "mission",
  "desiredOutcome",
  "audience",
  "timeline",
  "successCriteria"
];

export async function analyzePlanning(message: string, currentDraft?: PlanningDraft): Promise<PlanningAnalysis> {
  const aiAnalysis = await generateGeminiJson<PlanningAnalysis>({
    prompt: buildPlanningPrompt(message, currentDraft),
    responseSchema: planningResponseSchema
  });

  return normalizePlanning(aiAnalysis ?? analyzePlanningLocally(message, currentDraft));
}

function analyzePlanningLocally(message: string, currentDraft?: PlanningDraft): PlanningAnalysis {
  const draft: PlanningDraft = { ...(currentDraft ?? {}) };
  const clean = message.replace(/^\/plan\s*/i, "").trim();

  if (!draft.title && clean) draft.title = titleFromMessage(clean);
  if (!draft.mission && clean) draft.mission = clean;
  if (!draft.desiredOutcome) draft.desiredOutcome = extractOutcome(clean);
  if (!draft.timeline) draft.timeline = extractTimeline(clean);
  if (!draft.audience) draft.audience = extractAudience(clean);
  if (!draft.successCriteria) draft.successCriteria = extractSuccessCriteria(clean, draft.desiredOutcome);

  const missing = requiredFields
    .filter((field) => !draft[field])
    .map((field) => ({
      field,
      status: "missing" as const,
      question: questionForField(field)
    }));

  return {
    reasoning: "Local planning pass extracted obvious fields and identified missing requirements.",
    fulfilled_fields: requiredFields.filter((field) => Boolean(draft[field])).map((field) => ({ field, status: "fulfilled" as const, value: draft[field] })),
    missing_fields: missing,
    recommended_next_questions: missing.slice(0, 2).map((field) => field.question ?? `What is the ${field.field}?`),
    draft,
    ready_to_create: missing.length === 0
  };
}

function normalizePlanning(analysis: PlanningAnalysis): PlanningAnalysis {
  const draft = analysis.draft ?? {};
  const missing = requiredFields
    .filter((field) => !draft[field])
    .map((field) => ({
      field,
      status: "missing" as const,
      question: questionForField(field)
    }));

  return {
    ...analysis,
    draft,
    missing_fields: missing.length ? missing : analysis.missing_fields ?? [],
    fulfilled_fields: analysis.fulfilled_fields ?? [],
    recommended_next_questions: missing.length
      ? missing.slice(0, 2).map((field) => field.question ?? `What is the ${field.field}?`)
      : analysis.recommended_next_questions ?? [],
    ready_to_create: missing.length === 0
  };
}

function titleFromMessage(message: string): string {
  const normalized = message
    .replace(/\bfor\b.+$/i, "")
    .replace(/\bso\b.+$/i, "")
    .replace(/\b(next|this)\s+(week|month|quarter|year)\b.+$/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized;
}

function extractOutcome(message: string): string | undefined {
  const soMatch = message.match(/\bso(?: that)?\s+(.+)$/i);
  if (soMatch?.[1]) return soMatch[1].trim();

  const outcomeMatch = message.match(/\b(?:outcome|goal is|in order to)\s+(.+)$/i);
  return outcomeMatch?.[1]?.trim();
}

function extractTimeline(message: string): string | undefined {
  const timelineMatch = message.match(/\b(today|tomorrow|this week|next week|this month|next month|this quarter|next quarter|this year|next year|by\s+[^,.]+)\b/i);
  return timelineMatch?.[1]?.trim();
}

function extractAudience(message: string): string | undefined {
  const audienceMatch = message.match(/\bfor\s+(.+?)(?:\s+(?:today|tomorrow|this week|next week|this month|next month|this quarter|next quarter|this year|next year|by\b|so\b)|$)/i);
  return audienceMatch?.[1]?.trim();
}

function extractSuccessCriteria(message: string, outcome?: string): string | undefined {
  const successMatch = message.match(/\b(?:success|done|complete|measure|metric)\s+(?:is|means|by)?\s+(.+)$/i);
  if (successMatch?.[1]) return successMatch[1].trim();
  if (outcome && /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred)\b/i.test(outcome)) return outcome;
  return undefined;
}

function questionForField(field: keyof PlanningDraft): string {
  const questions: Record<keyof PlanningDraft, string> = {
    title: "What should we call this quest?",
    mission: "What mission should this project serve?",
    desiredOutcome: "What outcome would make this feel complete?",
    audience: "Who is this for or who should be involved?",
    timeline: "What timeline or deadline should I plan around?",
    constraints: "Are there any constraints I should respect?",
    successCriteria: "How will we know the quest succeeded?"
  };
  return questions[field];
}
