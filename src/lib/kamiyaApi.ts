import type { ChatMessage, ChatTurnRequest, ChatTurnResponse, KamiyaAuthContext, KamiyaSavedChat, KamiyaSavedChatSummary, KamiyaSessionState } from "../../shared/types";

export async function sendChatTurn(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const response = await fetch("/api/chat/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Kamiya API failed");
  }

  return response.json();
}

export function makeUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date().toISOString()
  };
}

export async function listSavedChats(auth: KamiyaAuthContext): Promise<KamiyaSavedChatSummary[]> {
  const response = await fetch("/api/chats/list", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to list Kamiya chats");
  }

  const data = (await response.json()) as { chats?: KamiyaSavedChatSummary[] };
  return data.chats ?? [];
}

export async function loadSavedChat(auth: KamiyaAuthContext, chatId: number): Promise<KamiyaSavedChat> {
  const response = await fetch("/api/chats/load", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth, chatId })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load Kamiya chat");
  }

  const data = (await response.json()) as { chat: KamiyaSavedChat };
  return data.chat;
}

export async function hydrateAction(auth: KamiyaAuthContext, session: KamiyaSessionState, actionId: string, signal?: AbortSignal): Promise<ChatTurnResponse> {
  const response = await fetch("/api/actions/hydrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth, session, actionId }),
    signal
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to hydrate Cerbanimo action");
  }

  return response.json();
}
