import type { ChannelOutboundMessage, ChatClientChannel, ChatTurnResponse } from "../../shared/types";

export function toChannelOutbound(channel: ChatClientChannel, response: ChatTurnResponse): ChannelOutboundMessage {
  return {
    channel,
    text: response.message.content,
    cards: response.message.cards ?? []
  };
}

export function extractText(body: Record<string, unknown>, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = candidate.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, body);
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function extractString(body: Record<string, unknown>, candidates: string[]): string {
  return extractText(body, candidates);
}
