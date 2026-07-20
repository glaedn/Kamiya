import type { ChatTurnRequest, RoutedIntent } from "../../shared/types";
import { intentResponseSchema } from "../ai/jsonSchemas";
import { generateGeminiJson } from "../ai/geminiClient";
import { buildIntentPrompt } from "../ai/prompts";
import { routeIntentLocally } from "./localIntentRouter";

export async function routeIntent(request: ChatTurnRequest): Promise<RoutedIntent> {
  const prompt = buildIntentPrompt(request.message, request.auth);
  const routed = await generateGeminiJson<RoutedIntent>({
    prompt,
    responseSchema: intentResponseSchema
  }).catch(() => null);

  return normalizeIntent(routed ?? routeIntentLocally(request.message));
}

export function normalizeIntent(intent: RoutedIntent): RoutedIntent {
  return {
    ...intent,
    confidence: Math.max(0, Math.min(1, intent.confidence)),
    required_inputs: intent.required_inputs ?? [],
    entities: intent.entities ?? {},
    // The model identifies the domain well but can still ask for inputs that a
    // read-only stats request does not need. Application logic owns statistics.
    next_action: intent.intent === "statistics" ? "show_stats" : intent.next_action
  };
}
