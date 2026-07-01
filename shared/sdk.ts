export { slashCommands, matchSlashCommand, suggestSlashCommands } from "./commands";
import type { ChatTurnRequest, ChatTurnResponse } from "./types";

export type {
  ActionExecutionRecord,
  ActionPreview,
  AgentMode,
  AutomationWorkflowKind,
  CardAction,
  ChatClientChannel,
  ChatMessage,
  ChatTurnRequest,
  ChatTurnResponse,
  ChannelInboundMessage,
  ChannelOutboundMessage,
  KamiyaAuthContext,
  KamiyaSessionState,
  ResponseCard,
  RoutedIntent
} from "./types";

export interface KamiyaSdkOptions {
  baseUrl: string;
  token?: string;
}

export class KamiyaSdk {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: KamiyaSdkOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  async chatTurn(request: ChatTurnRequest): Promise<ChatTurnResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat/turn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) throw new Error(`Kamiya SDK chat turn failed: ${response.status}`);
    return response.json();
  }
}
