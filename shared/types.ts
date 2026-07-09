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
  | "workflow_progress"
  | "workflow_failure"
  | "evidence"
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
  cerbanimoActionId?: string;
  cerbanimoActionUuid?: string;
  requestId?: string;
  functionName?: "projects.bootstrap" | string;
}

export type CerbanimoActionStatus =
  | "previewed"
  | "confirmed"
  | "queued"
  | "running"
  | "retry_wait"
  | "blocked"
  | "failed"
  | "completed"
  | "executed"
  | "cancelled";

export interface ActiveCerbanimoActionState {
  actionId: string;
  actionUuid?: string;
  workflowRunId?: string;
  functionName: "projects.bootstrap";
  status: CerbanimoActionStatus;
  currentStage?: string;
  projectId?: number;
  startedAt?: string;
  lastHydratedAt?: string;
  requestId?: string;
}

export interface CerbanimoWorkflowStep {
  id?: number | string;
  workflow_run_id?: number | string;
  step_name: string;
  status: string;
  result?: unknown;
  payload?: unknown;
  started_at?: string;
  completed_at?: string;
}

export interface CerbanimoWorkflow {
  id: number | string;
  workflow_type?: string | null;
  status: CerbanimoActionStatus | string;
  action_id?: number | string | null;
  actor_user_id?: number | string | null;
  related_project_id?: number | null;
  attempt_count?: number | null;
  state?: Record<string, unknown> | null;
  last_error?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CerbanimoAction {
  id: number | string;
  action_uuid?: string | null;
  status: CerbanimoActionStatus | string;
  risk_level?: string | null;
  intent_json?: Record<string, unknown> | null;
  preview_payload?: Record<string, unknown> | null;
  execution_result?: unknown;
  related_project_id?: number | null;
  related_task_id?: number | null;
  related_automation_run_id?: number | string | null;
  created_at?: string | null;
  confirmed_at?: string | null;
  executed_at?: string | null;
}

export interface CerbanimoProject {
  id: number;
  name?: string;
  title?: string;
  description?: string;
  due_date?: string | null;
  outcomeStatement?: string;
  outcomestatement?: string;
  outcome_statement?: string;
  [key: string]: unknown;
}

export type TaskAutomationClassification = "human_driven" | "assisted_automation" | "fully_automatable";

export interface TaskAutomationInput {
  key: string;
  label: string;
  description?: string;
  inputType: string;
  required: boolean;
  sensitive: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface TaskAutomationMetadata {
  classification: TaskAutomationClassification;
  confidenceBand?: "low" | "medium" | "high" | null;
  rationale?: string;
  requiredHumanInputs: TaskAutomationInput[];
  requirements: {
    capabilities?: string[];
    tools?: string[];
    externalServices?: string[];
    permissions?: string[];
    expectedArtifacts?: string[];
    estimatedDurationMinutes?: number;
    networkAccess?: "none" | "restricted" | "required";
    [key: string]: unknown;
  };
  validationRequirements: Array<{
    requirementId: string;
    description?: string;
    proofTypes?: string[];
    checks?: string[];
  }>;
  source?: "generated" | "manual" | "legacy_default" | "policy_downgrade" | "review_override";
  version?: string;
  classifiedAt?: string | null;
  findings?: Array<{ code?: string; field?: string; message?: string }>;
}

export interface CerbanimoTask {
  id: number | string;
  project_id?: number;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  skill_name?: string;
  skill_level?: number;
  reward_tokens?: number;
  due_date?: string | null;
  dependencies?: Array<number | string>;
  resolvedDependencies?: Array<number | string>;
  automation?: TaskAutomationMetadata;
  [key: string]: unknown;
}

export interface TaskAutomationValidationResult {
  valid: boolean;
  errors: Array<{ key?: string; code?: string; message?: string }>;
  findings?: Array<{ key?: string; code?: string; message?: string }>;
  sanitizedValues?: Record<string, unknown>;
}

export interface TaskAutomationCapabilityState {
  classification?: TaskAutomationClassification | string;
  requiredCapabilities: string[];
  availableCapabilities: string[];
  missingCapabilities: string[];
  actorAuthorized: boolean;
  executionAvailable: boolean;
  templateKey?: string | null;
  executor?: string | null;
  reasons: string[];
}

export interface TaskAutomationPreparation {
  id: number | string;
  preparation_uuid?: string | null;
  task_id?: number | string;
  actor_user_id?: number | string;
  capability_name?: string | null;
  status: "draft" | "invalid" | "ready" | "previewed" | "consumed" | "cancelled" | string;
  input_schema_snapshot?: TaskAutomationInput[];
  input_values?: Record<string, unknown>;
  validation_result?: TaskAutomationValidationResult | null;
  capability_snapshot?: TaskAutomationCapabilityState | null;
  preview_action_id?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskAutomationContext {
  task: CerbanimoTask;
  automation: TaskAutomationMetadata;
  inputSchema: TaskAutomationInput[];
  preparation?: TaskAutomationPreparation | null;
  validation?: TaskAutomationValidationResult | null;
  capability: TaskAutomationCapabilityState;
  policies?: Record<string, unknown>;
  action?: CerbanimoAction;
  template?: Record<string, unknown>;
}

export interface TaskEvidenceRequirement {
  requirementId: string;
  description?: string;
  acceptedEvidenceTypes?: string[];
  proofTypes?: string[];
  checks?: string[];
  minimumEvidenceItems?: number;
  semanticReview?: boolean;
}

export interface TaskEvidenceItem {
  id: number | string;
  evidence_uuid?: string | null;
  evidence_type: string;
  requirement_ids?: string[];
  title?: string | null;
  text_content?: string | null;
  source_url?: string | null;
  canonical_url?: string | null;
  artifact_uri?: string | null;
  media_type?: string | null;
  byte_size?: number | string | null;
  content_sha256?: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
}

export interface TaskEvidenceBundle {
  id: number | string;
  bundle_uuid?: string | null;
  task_id?: number | string;
  actor_user_id?: number | string | null;
  source_kind?: "human" | "automation" | "mixed" | string;
  status: string;
  version?: number;
  reflection?: string | null;
  summary?: string | null;
  requirement_snapshot?: TaskEvidenceRequirement[];
  action_id?: number | string | null;
  actionId?: string | null;
  items?: TaskEvidenceItem[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskEvidenceContext {
  task?: CerbanimoTask;
  requirements?: TaskEvidenceRequirement[];
  bundle?: TaskEvidenceBundle;
  bundles?: TaskEvidenceBundle[];
  action?: CerbanimoAction | null;
  validations?: Array<Record<string, unknown>>;
  createdItemId?: number | string;
}

export interface AutomationRunResult {
  status: "checks_passed" | "checks_failed" | "blocked" | "cancelled" | "executor_failed" | "completed" | string;
  reportType?: string;
  taskId?: number | string;
  taskName?: string;
  repository?: string;
  ref?: string;
  checkProfile?: string;
  executor?: string;
  summary?: string;
  artifactUri?: string;
  submittedTask?: boolean;
  checks?: Array<{ key?: string; status?: string; message?: string }>;
  completedAt?: string;
  reason?: string;
  message?: string;
}

export interface AutomationRun {
  id: number | string;
  run_uuid?: string | null;
  action_id?: number | string | null;
  preparation_id?: number | string | null;
  template_key?: string;
  status: string;
  input?: Record<string, unknown>;
  result?: AutomationRunResult | Record<string, unknown> | null;
  allowedActions?: {
    cancel?: boolean;
    retry?: boolean;
    startNewRun?: boolean;
  };
  logs?: Array<{ level?: string; message?: string; payload?: unknown; created_at?: string | null }>;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ProjectBootstrapActionDetail {
  action: CerbanimoAction;
  workflow?: CerbanimoWorkflow | null;
  steps: CerbanimoWorkflowStep[];
  project?: CerbanimoProject | null;
  tasks: CerbanimoTask[];
  activeTasks: CerbanimoTask[];
  terminal: boolean;
  result?: unknown;
  error?: unknown;
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
  lastProjectAction?: ActionPreview;
  activeAction?: ActiveCerbanimoActionState;
  e2eScenario?: string;
  e2eRunId?: string;
  e2eControlDir?: string;
}

export interface PlanningDraft {
  title?: string;
  mission?: string;
  desiredOutcome?: string;
  audience?: string;
  timeline?: string;
  constraints?: string;
  successCriteria?: string;
  tags?: string[];
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
  code?: string | number;
  status?: number;
  requestId?: string;
  retryable?: boolean;
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
