import type { ChatMessage } from "../../shared/types";
import { generateGeminiJson } from "../ai/geminiClient";
import { chatTitleResponseSchema } from "../ai/jsonSchemas";
import { buildChatTitlePrompt } from "../ai/prompts";

export async function generateChatName(messages: ChatMessage[]): Promise<string> {
  const aiTitle = await generateGeminiJson<{ chatName: string }>({
    prompt: buildChatTitlePrompt(messages.map(({ role, content }) => ({ role, content }))),
    responseSchema: chatTitleResponseSchema
  }).catch(() => null);

  return sanitizeChatName(aiTitle?.chatName) ?? fallbackChatName(messages);
}

function fallbackChatName(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  if (!firstUserMessage) return "New Kamiya Chat";

  return sanitizeChatName(
    firstUserMessage.content
      .replace(/^\/\w+\s*/i, "")
      .replace(/\b(project|quest)\s+(named|called|for)\b/i, "")
      .replace(/[.?!]+$/g, "")
  ) ?? "New Kamiya Chat";
}

function sanitizeChatName(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
}
