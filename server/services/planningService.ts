import type { PlanningAnalysis, PlanningDraft } from "../../shared/types";
import { planningResponseSchema } from "../ai/jsonSchemas";
import { generateGeminiJson } from "../ai/geminiClient";
import { buildPlanningPrompt } from "../ai/prompts";

const requiredFields: Array<keyof PlanningDraft> = ["title", "mission", "desiredOutcome"];

export async function analyzePlanning(message: string, currentDraft?: PlanningDraft): Promise<PlanningAnalysis> {
  const serverNow = new Date();
  const localAnalysis = analyzePlanningLocally(message, currentDraft, serverNow);
  const aiAnalysis = await generateGeminiJson<PlanningAnalysis>({
    prompt: buildPlanningPrompt(message, currentDraft, serverNow),
    responseSchema: planningResponseSchema
  }).catch(() => null);

  if (!aiAnalysis) return normalizePlanning(localAnalysis);

  return normalizePlanning({
    ...aiAnalysis,
    draft: mergeDrafts(localAnalysis.draft, aiAnalysis.draft),
    fulfilled_fields: [...localAnalysis.fulfilled_fields, ...(aiAnalysis.fulfilled_fields ?? [])]
  });
}

function analyzePlanningLocally(message: string, currentDraft?: PlanningDraft, serverNow = new Date()): PlanningAnalysis {
  const draft: PlanningDraft = { ...(currentDraft ?? {}) };
  const clean = message.replace(/^\/(plan|create)\s*/i, "").trim();
  const explicitTitle = extractTitle(clean);
  const explicitMission = extractMission(clean);
  const explicitDescription = extractDescription(clean);

  if (explicitTitle) draft.title = explicitTitle;
  if (!draft.title && clean) draft.title = titleFromMessage(clean);
  if (explicitDescription) draft.mission = explicitDescription;
  if (!explicitDescription && explicitMission) draft.mission = explicitMission;
  if (!draft.mission && clean) draft.mission = clean;
  if (!draft.desiredOutcome) draft.desiredOutcome = extractOutcome(clean) ?? inferOutcome(clean);
  if (!draft.timeline) draft.timeline = extractTimeline(clean, serverNow);
  if (!draft.audience) draft.audience = extractAudience(clean);
  if (!draft.successCriteria) draft.successCriteria = extractSuccessCriteria(clean, draft.desiredOutcome);
  if (!draft.desiredOutcome && draft.successCriteria) draft.desiredOutcome = draft.successCriteria;

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

function compactDraft(draft: PlanningDraft): PlanningDraft {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => Boolean(value))) as PlanningDraft;
}

function mergeDrafts(localDraft: PlanningDraft, aiDraft?: PlanningDraft): PlanningDraft {
  const compactLocal = compactDraft(localDraft);
  const compactAi = compactDraft(aiDraft ?? {});
  return {
    ...compactLocal,
    ...compactAi
  };
}

function titleFromMessage(message: string): string {
  const localCommunityMatch = message.match(/\blocal\s+([A-Za-z][\w\s'-]{1,50}?)\s+(?:weekly\s+)?(?:get together|meetup|meeting|club|group)\s+(?:around|for|about)\s+(.+?)(?:\s+(?:starting|in|within|by|so)\b|$)/i);
  if (localCommunityMatch?.[1] && localCommunityMatch?.[2]) {
    return toTitle(`${localCommunityMatch[1].trim()} Weekly ${shortTopic(localCommunityMatch[2])} meetup`);
  }

  const projectForMatch = message.match(/^project\s+for\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+(?:today|tomorrow|this week|next week|this month|next month|this quarter|next quarter|this year|next year|by\b|so\b)|$)/i);
  if (projectForMatch?.[1]) return toTitle(projectForMatch[1]);

  const normalized = message
    .replace(/^create\s+(?:a\s+)?(?:project|quest)\s+(?:for|to)?\s*/i, "")
    .replace(/\bfor\b.+$/i, "")
    .replace(/\bso\b.+$/i, "")
    .replace(/\b(?:starting\s+)?(?:in\s+)?\d+\s+(?:days?|weeks?|months?)\b.+$/i, "")
    .replace(/\b(next|this)\s+(week|month|quarter|year)\b.*$/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized;
}

function extractTitle(message: string): string | undefined {
  const titleMatch = message.match(/\b(?:project|quest)\s+(?:named|called)\s+(.+?)(?:[,.]|\s+(?:description|outcome|goal|mission)\b|$)/i);
  return titleMatch?.[1] ? toTitle(titleMatch[1]) : undefined;
}

function toTitle(value: string): string {
  return value
    .replace(/[.?!]+$/, "")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (/[A-Z]/.test(word.slice(1))) return word;
      return word.length <= 3 ? word.toLowerCase() : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
    })
    .join(" ");
}

function extractMission(message: string): string | undefined {
  const missionMatch = message.match(/\bmission\s+(?:is|to|should)\s+(.+?)(?:,\s*(?:the\s+)?(?:audience|timeline|success|outcome)\b|$)/i);
  return missionMatch?.[1]?.trim();
}

function extractDescription(message: string): string | undefined {
  const descriptionMatch = message.match(/\b(?:description|project description)\s+(?:is|should be|:)\s+(.+?)(?:,\s*(?:the\s+)?(?:audience|timeline|success|outcome|goal|mission)\b|$)/i);
  return descriptionMatch?.[1]?.trim();
}

function extractOutcome(message: string): string | undefined {
  const soMatch = message.match(/\bso(?: that)?\s+(.+)$/i);
  if (soMatch?.[1]) return soMatch[1].trim();

  const outcomeMatch = message.match(/\b(?:outcome|goal is|goal|in order to)\s+(?:is\s+)?(.+?)(?:,\s*(?:the\s+)?(?:audience|timeline|success|mission)\b|$)/i);
  return outcomeMatch?.[1]?.trim();
}

function inferOutcome(message: string): string | undefined {
  const localCommunityMatch = message.match(/\blocal\s+([A-Za-z][\w\s'-]{1,50}?)\s+(?:weekly\s+)?(?:get together|meetup|meeting|club|group)\s+(?:around|for|about)\s+(.+?)(?:\s+(?:starting|in|within|by)\b|$)/i);
  if (localCommunityMatch?.[2]) {
    return `Build a local community around weekly ${shortTopic(localCommunityMatch[2])} meetups`;
  }

  const createMatch = message.match(/\b(?:create|start|launch|build)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+(?:starting|in|within|by)\b|$)/i);
  if (createMatch?.[1]) return `Successfully ${message.trim().toLowerCase().startsWith("build") ? "build" : "create"} ${createMatch[1].trim()}`;

  return undefined;
}

function extractTimeline(message: string, serverNow: Date): string | undefined {
  const timelineMatch = message.match(/\b(today|tomorrow|this week|next week|this month|next month|this quarter|next quarter|this year|next year|(?:starting\s+)?in\s+\d+\s+(?:days?|weeks?|months?)|within\s+\d+\s+(?:days?|weeks?|months?)|by\s+[^,.]+|\d{4}-\d{2}-\d{2})\b/i);
  return timelineMatch?.[1] ? resolveTimeline(timelineMatch[1].trim(), serverNow) : undefined;
}

function resolveTimeline(value: string, serverNow: Date): string | undefined {
  const lower = value.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;

  const start = startOfLocalDay(serverNow);
  if (lower === "today") return formatDate(start);
  if (lower === "tomorrow") return formatDate(addDays(start, 1));
  if (lower === "this week") return formatDate(endOfWeek(start, 0));
  if (lower === "next week") return formatDate(endOfWeek(start, 1));
  if (lower === "this month") return formatDate(endOfMonth(start, 0));
  if (lower === "next month") return formatDate(endOfMonth(start, 1));
  if (lower === "this quarter") return formatDate(endOfQuarter(start, 0));
  if (lower === "next quarter") return formatDate(endOfQuarter(start, 1));
  if (lower === "this year") return `${start.getFullYear()}-12-31`;
  if (lower === "next year") return `${start.getFullYear() + 1}-12-31`;

  const relativeMatch = lower.match(/^(?:starting\s+)?(?:in|within)\s+(\d+)\s+(days?|weeks?|months?)$/);
  if (relativeMatch?.[1] && relativeMatch?.[2]) {
    const amount = Number(relativeMatch[1]);
    if (relativeMatch[2].startsWith("day")) return formatDate(addDays(start, amount));
    if (relativeMatch[2].startsWith("week")) return formatDate(addDays(start, amount * 7));
    if (relativeMatch[2].startsWith("month")) return formatDate(addMonths(start, amount));
  }

  const byMatch = lower.match(/^by\s+(.+)$/);
  if (!byMatch?.[1]) return value;

  const parsed = parseDateLike(byMatch[1], start);
  return parsed ? formatDate(parsed) : value;
}

function parseDateLike(value: string, serverNow: Date): Date | undefined {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const monthMatch = value.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,\s*(\d{4}))?$/i);
  if (!monthMatch) return undefined;

  const month = monthIndex(monthMatch[1]);
  const day = Number(monthMatch[2]);
  const year = monthMatch[3] ? Number(monthMatch[3]) : inferYear(month, day, serverNow);
  return new Date(year, month, day);
}

function monthIndex(value: string): number {
  const normalized = value.slice(0, 3).toLowerCase();
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(normalized);
}

function inferYear(month: number, day: number, serverNow: Date): number {
  const candidate = new Date(serverNow.getFullYear(), month, day);
  return candidate < serverNow ? serverNow.getFullYear() + 1 : serverNow.getFullYear();
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function endOfWeek(value: Date, weeksFromNow: number): Date {
  const day = value.getDay();
  const daysUntilSunday = 6 - day + weeksFromNow * 7;
  return addDays(value, daysUntilSunday);
}

function endOfMonth(value: Date, monthsFromNow: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + monthsFromNow + 1, 0);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, value.getDate());
}

function endOfQuarter(value: Date, quartersFromNow: number): Date {
  const quarterStartMonth = Math.floor(value.getMonth() / 3) * 3;
  return new Date(value.getFullYear(), quarterStartMonth + (quartersFromNow + 1) * 3, 0);
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractAudience(message: string): string | undefined {
  const explicitAudience = message.match(/\baudience\s+(?:is|includes|should be)\s+(.+?)(?:,\s*(?:the\s+)?(?:mission|timeline|success|outcome)\b|$)/i);
  if (explicitAudience?.[1]) return explicitAudience[1].trim();

  const audienceMatch = message.match(/\bfor\s+(.+?)(?:\s+(?:today|tomorrow|this week|next week|this month|next month|this quarter|next quarter|this year|next year|by\b|so\b)|$)/i);
  return audienceMatch?.[1]?.trim();
}

function extractSuccessCriteria(message: string, outcome?: string): string | undefined {
  const successMatch = message.match(/\b(?:success|done|complete|measure|metric)\s+(?:is|means|by)?\s+(.+)$/i);
  if (successMatch?.[1]) return successMatch[1].trim();
  if (outcome && /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred)\b/i.test(outcome)) return outcome;
  return undefined;
}

function shortTopic(value: string): string {
  return value
    .replace(/\bMagic the Gathering\b/i, "MtG")
    .replace(/[.?!]+$/, "")
    .trim();
}

function questionForField(field: keyof PlanningDraft): string {
  const questions: Record<keyof PlanningDraft, string> = {
    title: "What should we call this quest?",
    mission: "What should the Cerbanimo project description say?",
    desiredOutcome: "What real-world outcome should Cerbanimo attach to this project?",
    audience: "Who is this for or who should be involved?",
    timeline: "What timeline or deadline should I plan around?",
    constraints: "Are there any constraints I should respect?",
    successCriteria: "How will we know the quest succeeded?"
  };
  return questions[field];
}
