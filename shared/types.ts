export type IntentCategory =
  | "planning"
  | "task_management"
  | "task_submission"
  | "automation"
  | "knowledge"
  | "search"
  | "statistics"
  | "navigation"
  | "community"
  | "administration"
  | "conversation"
  | "settings";

export type AgentMode = "auto" | "planner" | "builder" | "reviewer" | "automator" | "manager" | "coach";

export type ChatClientChannel = "web" | "discord" | "slack" | "google_chat" | "voice" | "sdk";

export type NextAction =
  | "ask_missing_inputs"
  | "create_project"
  | "show_tasks"
  | "submit_task"
  | "search_cerbanimo"
  | "show_stats"
  | "show_profile"
  | "show_notifications"
  | "switch_mode"
  | "show_modes"
  | "open_page"
  | "show_help"
  | "queue_automation"
  | "show_settings"
  | "respond";

export type FieldStatus = "fulfilled" | "missing" | "needs_confirmation";

export interface IntentField {
  field: string;
  status: FieldStatus;
  value?: string | number | boolean | string[];
  question?: string;
}

export interface RoutedIntent {
  reasoning: string;
  intent: IntentCategory | "task_submission";
  confidence: number;
  entities: Record<string, unknown>;
  required_inputs: IntentField[];
  next_action: NextAction;
}

export interface SlashCommand {
  name: string;
  label: string;
  intent: IntentCategory | "task_submission";
  description: string;
}

export interface KamiyaAuthContext {
  isLoggedIn: boolean;
  userId?: string;
  displayName?: string;
  cerbanimoApiUrl?: string;
  cerbanimoToken?: string;
  permissions?: string[];
  channel?: ChatClientChannel;
  externalUserId?: string;
  workspaceId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  cards?: ResponseCard[];
  intent?: RoutedIntent;
}

export type CardKind =
  | "project"
  | "task"
  | "community"
  | "profile"
  | "stats"
  | "automation"
  | "action_queue"
  | "validation_report"
  | "mode"
  | "integration"
  | "approval"
  | "timeline"
  | "quest_summary"
  | "search_results"
  | "action_preview"
  | "help";

export interface CardAction {
  id: string;
  label: string;
  style?: "primary" | "secondary" | "danger";
  command?: string;
  actionId?: string;
}

export interface ResponseCard {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  body?: string;
  metadata?: Record<string, string | number | boolean | string[]>;
  actions?: CardAction[];
  items?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    status?: string;
    metadata?: Record<string, string | number | boolean>;
  }>;
}

export type ActionKind =
  | "create_project"
  | "submit_task"
  | "join_community"
  | "claim_task"
  | "run_automation"
  | "open_page";

export type AutomationWorkflowKind =
  | "research_competitors"
  | "summarize_documents"
  | "generate_project_plan"
  | "create_github_issues"
  | "generate_pull_request"
  | "deploy_staging"
  | "monitor_deadlines"
  | "detect_blockers"
  | "schedule_reminder"
  | "validate_submission"
  | "review_pull_request"
  | "run_quality_checks"
  | "custom";

export type ActionExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ActionPreview {
  id: string;
  kind: ActionKind;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high";
  destructive: boolean;
  payload: Record<string, unknown>;
  requiredPermissions: string[];
  createdAt: string;
}

export interface ActionExecutionRecord {
  id: string;
  previewId: string;
  kind: ActionKind;
  status: ActionExecutionStatus;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  mocked?: boolean;
  cerbanimoActionId?: string;
}

export interface KamiyaSessionState {
  chatId?: number;
  chatName?: string;
  pendingAction?: ActionPreview;
  planningDraft?: PlanningDraft;
  planningDeadlinePrompted?: boolean;
  actionHistory?: ActionExecutionRecord[];
  mode?: AgentMode;
}

export interface PlanningDraft {
  title?: string;
  mission?: string;
  desiredOutcome?: string;
  audience?: string;
  timeline?: string;
  constraints?: string;
  successCriteria?: string;
}

export interface PlanningAnalysis {
  reasoning: string;
  fulfilled_fields: IntentField[];
  missing_fields: IntentField[];
  recommended_next_questions: string[];
  draft: PlanningDraft;
  ready_to_create: boolean;
}

export interface ChatTurnRequest {
  message: string;
  history: ChatMessage[];
  session: KamiyaSessionState;
  auth: KamiyaAuthContext;
  channel?: ChatClientChannel;
}

export interface ChatTurnResponse {
  message: ChatMessage;
  session: KamiyaSessionState;
}

export interface KamiyaSavedChatSummary {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
}

export interface KamiyaSavedChat extends KamiyaSavedChatSummary {
  userId?: number;
  messages: ChatMessage[];
  session: KamiyaSessionState;
}

export interface CerbanimoResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  mocked?: boolean;
}

export interface ChannelInboundMessage {
  channel: ChatClientChannel;
  text: string;
  externalUserId?: string;
  workspaceId?: string;
  threadId?: string;
  displayName?: string;
}

export interface ChannelOutboundMessage {
  channel: ChatClientChannel;
  text: string;
  cards: ResponseCard[];
}
