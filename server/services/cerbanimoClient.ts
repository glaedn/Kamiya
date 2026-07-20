import { z } from "zod";
import { checkCerbanimoContractIdentity } from "../../shared/cerbanimoContract";
import type {
  ActionPreview,
  ActiveCerbanimoActionState,
  AutomationRun,
  CerbanimoAction,
  CerbanimoResult,
  ChatMessage,
  KamiyaAuthContext,
  KamiyaSavedChat,
  KamiyaSavedChatSummary,
  KamiyaSessionState,
  CallingResponse,
  ChronicleResponse,
  InviteCreateResponse,
  InvitePreviewResponse,
  InviteRedeemResponse,
  LaunchPreviewResponse,
  NarrativePreferencesResponse,
  NarrativeSettingsResponse,
  PartyAssemblyContext,
  ProjectBootstrapActionDetail,
  QuestContext,
  QuestProfileResponse,
  TaskEvidenceContext,
  TaskAutomationContext,
  TaskReviewContext,
  TaskSettlementContext
} from "../../shared/types";

const apiEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().nullable().optional(),
  error: z.unknown().nullable().optional(),
  requestId: z.string().optional()
});

const cerbanimoActionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  action_uuid: z.string().optional().nullable(),
  status: z.string(),
  risk_level: z.string().optional().nullable(),
  intent_json: z.record(z.unknown()).optional().nullable(),
  preview_payload: z.record(z.unknown()).optional().nullable(),
  execution_result: z.unknown().optional().nullable(),
  related_project_id: z.number().optional().nullable(),
  related_task_id: z.number().optional().nullable(),
  related_automation_run_id: z.union([z.number(), z.string()]).optional().nullable(),
  created_at: z.string().optional().nullable(),
  confirmed_at: z.string().optional().nullable(),
  executed_at: z.string().optional().nullable()
}).passthrough();

const taskAutomationSchema = z.object({
  classification: z.enum(["human_driven", "assisted_automation", "fully_automatable"]).catch("human_driven"),
  confidenceBand: z.enum(["low", "medium", "high"]).nullable().optional().catch(null),
  rationale: z.string().optional().catch(undefined),
  requiredHumanInputs: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
    inputType: z.string(),
    required: z.boolean().default(true),
    sensitive: z.boolean().default(false),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional()
  }).passthrough()).default([]).catch([]),
  requirements: z.object({
    capabilities: z.array(z.string()).optional().catch([]),
    tools: z.array(z.string()).optional().catch([]),
    externalServices: z.array(z.string()).optional().catch([]),
    permissions: z.array(z.string()).optional().catch([]),
    expectedArtifacts: z.array(z.string()).optional().catch([]),
    estimatedDurationMinutes: z.number().optional(),
    networkAccess: z.enum(["none", "restricted", "required"]).optional().catch("none")
  }).passthrough().default({}).catch({}),
  validationRequirements: z.array(z.object({
    requirementId: z.string(),
    description: z.string().optional(),
    proofTypes: z.array(z.string()).optional(),
    checks: z.array(z.string()).optional()
  }).passthrough()).default([]).catch([]),
  source: z.enum(["generated", "manual", "legacy_default", "policy_downgrade", "review_override"]).optional().catch("legacy_default"),
  version: z.string().optional(),
  classifiedAt: z.string().nullable().optional(),
  findings: z.array(z.object({
    code: z.string().optional(),
    field: z.string().optional(),
    message: z.string().optional()
  }).passthrough()).default([]).catch([])
}).passthrough().catch({
  classification: "human_driven",
  requiredHumanInputs: [],
  requirements: {},
  validationRequirements: [],
  source: "legacy_default",
  findings: []
});

const taskSchema = z.object({
  id: z.union([z.number(), z.string()]),
  automation: taskAutomationSchema.optional().default({
    classification: "human_driven",
    requiredHumanInputs: [],
    requirements: {},
    validationRequirements: [],
    source: "legacy_default",
    findings: []
  })
}).passthrough();

const projectBootstrapActionDetailSchema = z.object({
  action: cerbanimoActionSchema,
  workflow: z.object({
    id: z.union([z.number(), z.string()]),
    status: z.string(),
    workflow_type: z.string().optional().nullable(),
    action_id: z.union([z.number(), z.string()]).optional().nullable(),
    related_project_id: z.number().optional().nullable(),
    attempt_count: z.number().optional().nullable(),
    state: z.record(z.unknown()).optional().nullable(),
    last_error: z.unknown().optional().nullable(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable()
  }).passthrough().nullable().optional(),
  steps: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(),
    workflow_run_id: z.union([z.number(), z.string()]).optional(),
    step_name: z.string(),
    status: z.string(),
    result: z.unknown().optional().nullable(),
    payload: z.unknown().optional().nullable(),
    started_at: z.string().optional().nullable(),
    completed_at: z.string().optional().nullable()
  }).passthrough()).default([]),
  project: z.object({ id: z.number() }).passthrough().nullable().optional(),
  tasks: z.array(taskSchema).default([]),
  activeTasks: z.array(taskSchema).default([]),
  terminal: z.boolean().default(false),
  result: z.unknown().optional().nullable(),
  error: z.unknown().optional().nullable()
}).passthrough();

const taskAutomationInputSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  inputType: z.string(),
  required: z.boolean().default(true),
  sensitive: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional()
}).passthrough();

const taskAutomationValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    key: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional()
  }).passthrough()).default([]),
  findings: z.array(z.object({
    key: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional()
  }).passthrough()).default([]).optional(),
  sanitizedValues: z.record(z.unknown()).optional()
}).passthrough();

const taskAutomationCapabilitySchema = z.object({
  classification: z.string().optional(),
  requiredCapabilities: z.array(z.string()).default([]),
  availableCapabilities: z.array(z.string()).default([]),
  missingCapabilities: z.array(z.string()).default([]),
  actorAuthorized: z.boolean().default(false),
  executionAvailable: z.boolean().default(false),
  templateKey: z.string().nullable().optional(),
  executor: z.string().nullable().optional(),
  reasons: z.array(z.string()).default([])
}).passthrough();

const taskAutomationPreparationSchema = z.object({
  id: z.union([z.number(), z.string()]),
  preparation_uuid: z.string().optional().nullable(),
  task_id: z.union([z.number(), z.string()]).optional(),
  actor_user_id: z.union([z.number(), z.string()]).optional(),
  capability_name: z.string().optional().nullable(),
  status: z.string(),
  input_schema_snapshot: z.array(taskAutomationInputSchema).optional(),
  input_values: z.record(z.unknown()).optional(),
  validation_result: taskAutomationValidationSchema.optional().nullable(),
  capability_snapshot: taskAutomationCapabilitySchema.optional().nullable(),
  preview_action_id: z.union([z.number(), z.string()]).optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable()
}).passthrough();

const taskAutomationContextSchema = z.object({
  task: taskSchema,
  automation: taskAutomationSchema,
  inputSchema: z.array(taskAutomationInputSchema).default([]),
  preparation: taskAutomationPreparationSchema.optional().nullable(),
  validation: taskAutomationValidationSchema.optional().nullable(),
  capability: taskAutomationCapabilitySchema,
  policies: z.record(z.unknown()).optional(),
  action: cerbanimoActionSchema.optional(),
  template: z.record(z.unknown()).optional()
}).passthrough();

const semanticReviewSchema = z.preprocess((value) => {
  if (value === true) return "required";
  if (value === false || value === undefined || value === null || value === "") return "never";
  return value;
}, z.enum(["never", "optional", "required", "configuration_error"]).catch("configuration_error"));

const taskEvidenceRequirementSchema = z.object({
  requirementId: z.string(),
  description: z.string().optional(),
  acceptedEvidenceTypes: z.array(z.string()).optional().catch([]),
  proofTypes: z.array(z.string()).optional().catch([]),
  checks: z.array(z.string()).optional().catch([]),
  minimumEvidenceItems: z.number().optional(),
  semanticReview: semanticReviewSchema.optional().default("never")
}).passthrough();

const taskEvidenceItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  evidence_uuid: z.string().optional().nullable(),
  evidence_type: z.string(),
  requirement_ids: z.array(z.string()).optional().catch([]),
  title: z.string().optional().nullable(),
  text_content: z.string().optional().nullable(),
  source_url: z.string().optional().nullable(),
  canonical_url: z.string().optional().nullable(),
  artifact_uri: z.string().optional().nullable(),
  media_type: z.string().optional().nullable(),
  byte_size: z.union([z.number(), z.string()]).optional().nullable(),
  content_sha256: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional().nullable()
}).passthrough();

const taskEvidenceBundleSchema = z.object({
  id: z.union([z.number(), z.string()]),
  bundle_uuid: z.string().optional().nullable(),
  task_id: z.union([z.number(), z.string()]).optional(),
  actor_user_id: z.union([z.number(), z.string()]).optional().nullable(),
  source_kind: z.string().optional(),
  status: z.string(),
  version: z.number().optional(),
  reflection: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  requirement_snapshot: z.array(taskEvidenceRequirementSchema).optional(),
  action_id: z.union([z.number(), z.string()]).optional().nullable(),
  actionId: z.string().optional().nullable(),
  items: z.array(taskEvidenceItemSchema).optional().default([]),
  itemCount: z.number().optional(),
  validationStatus: z.string().optional(),
  requirementCoverage: z.array(z.object({
    requirementId: z.string(),
    status: z.string(),
    evidenceItemCount: z.number()
  }).passthrough()).optional().default([]),
  supersedes_bundle_id: z.union([z.number(), z.string()]).optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable()
}).passthrough();

const taskEvidenceContextSchema = z.object({
  task: taskSchema.optional(),
  requirements: z.array(taskEvidenceRequirementSchema).optional().default([]),
  bundle: taskEvidenceBundleSchema.optional(),
  bundles: z.array(taskEvidenceBundleSchema).optional(),
  action: cerbanimoActionSchema.optional().nullable(),
  validations: z.array(z.record(z.unknown())).optional().default([]),
  createdItemId: z.union([z.number(), z.string()]).optional(),
  allowedActions: z.object({
    update: z.boolean().optional(),
    addItem: z.boolean().optional(),
    fetchUrl: z.boolean().optional(),
    preview: z.boolean().optional(),
    cancel: z.boolean().optional(),
    confirm: z.boolean().optional()
  }).partial().optional()
}).passthrough();

const reviewAllowedActionsSchema = z.object({
  acceptAssignment: z.boolean().optional(),
  bless: z.boolean().optional(),
  requestChanges: z.boolean().optional(),
  reject: z.boolean().optional(),
  recuse: z.boolean().optional(),
  seal: z.boolean().optional()
}).partial().optional();

const taskSettlementRewardSchema = z.object({
  amount: z.coerce.number(),
  tokenType: z.string(),
  postedAt: z.string().optional().nullable()
}).passthrough();

const taskSettlementSchema = z.object({
  settlementId: z.string().optional(),
  settlementRecordId: z.union([z.number(), z.string()]).optional(),
  status: z.string(),
  attemptCount: z.number().optional(),
  policyVersion: z.string().optional(),
  task: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    completedAt: z.string().optional().nullable()
  }).optional(),
  project: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    completed: z.boolean().optional(),
    completedAt: z.string().optional().nullable(),
    remainingRequiredTasks: z.number().optional()
  }).optional(),
  rewards: z.object({
    contributor: z.array(taskSettlementRewardSchema).optional().default([]),
    peerReviewers: z.array(taskSettlementRewardSchema).optional().default([]),
    pmReviewer: z.array(taskSettlementRewardSchema).optional().default([])
  }).optional(),
  skillChanges: z.array(z.object({
    skillId: z.union([z.number(), z.string()]),
    xpDelta: z.number(),
    previousXp: z.number(),
    newXp: z.number(),
    previousLevel: z.number(),
    newLevel: z.number(),
    levelChanged: z.boolean()
  }).passthrough()).optional().default([]),
  activatedTasks: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    name: z.string().optional(),
    status: z.string().optional()
  }).passthrough()).optional().default([]),
  storyEvent: z.object({ created: z.boolean().optional(), eventId: z.string().optional().nullable() }).optional(),
  completionRecord: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    uuid: z.string().optional(),
    completedAt: z.string().optional().nullable()
  }).optional().nullable(),
  action: z.object({
    id: z.union([z.number(), z.string()]),
    uuid: z.string().optional().nullable(),
    status: z.string().optional(),
    preview: z.record(z.unknown()).optional().nullable()
  }).optional().nullable(),
  lastError: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    retryable: z.boolean().optional(),
    details: z.record(z.unknown()).optional()
  }).optional().nullable(),
  progress: z.object({
    status: z.string().optional(),
    stages: z.array(z.string()).optional().default([]),
    eventCount: z.number().optional()
  }).optional(),
  effectSummary: z.record(z.number()).optional(),
  copy: z.string().optional(),
  allowedActions: z.object({
    view: z.boolean().optional(),
    confirm: z.boolean().optional(),
    retry: z.boolean().optional(),
    cancel: z.boolean().optional(),
    reconcile: z.boolean().optional()
  }).partial().optional()
}).passthrough();

const taskReviewRoundSchema = z.object({
  id: z.union([z.number(), z.string()]),
  round_uuid: z.string().optional().nullable(),
  task_id: z.union([z.number(), z.string()]).optional(),
  bundle_id: z.union([z.number(), z.string()]).optional(),
  validation_result_id: z.union([z.number(), z.string()]).optional(),
  status: z.string(),
  stage: z.string().optional(),
  risk_tier: z.string().optional(),
  policy_version: z.string().optional(),
  peer_approvals_required: z.number().optional(),
  peer_approvals_received: z.number().optional(),
  peer_deadline_at: z.string().optional().nullable(),
  peer_gate_method: z.string().optional().nullable(),
  pm_deadline_at: z.string().optional().nullable(),
  pm_gate_method: z.string().optional().nullable(),
  shortage_flag: z.boolean().optional(),
  accepted_at: z.string().optional().nullable(),
  settlement_status: z.string().optional().nullable()
}).passthrough();

const taskReviewAssignmentSchema = z.object({
  id: z.union([z.number(), z.string()]),
  assignment_uuid: z.string().optional().nullable(),
  review_round_id: z.union([z.number(), z.string()]).optional(),
  reviewer_user_id: z.union([z.number(), z.string()]).optional(),
  reviewer_role: z.string(),
  status: z.string(),
  assigned_at: z.string().optional().nullable(),
  accepted_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  risk_tier: z.string().optional(),
  task: z.object({ name: z.string().optional(), projectName: z.string().optional().nullable() }).optional()
}).passthrough();

const taskReviewDecisionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  decision_uuid: z.string().optional().nullable(),
  review_round_id: z.union([z.number(), z.string()]).optional(),
  assignment_id: z.union([z.number(), z.string()]).optional(),
  reviewer_user_id: z.union([z.number(), z.string()]).optional(),
  decision: z.string(),
  reason: z.string().optional().nullable(),
  requirement_findings: z.array(z.record(z.unknown())).optional().default([]),
  decision_source: z.string().optional(),
  created_at: z.string().optional().nullable()
}).passthrough();

const taskReviewContextSchema = z.object({
  reviewFeature: z.object({
    enabled: z.boolean().optional(),
    policyVersion: z.string().optional(),
    manifestVersionRequired: z.string().optional()
  }).optional(),
  status: z.string().optional(),
  taskId: z.union([z.number(), z.string()]).optional(),
  round: taskReviewRoundSchema.optional(),
  assignment: taskReviewAssignmentSchema.optional().nullable(),
  assignments: z.array(taskReviewAssignmentSchema).optional().default([]),
  decisions: z.array(taskReviewDecisionSchema).optional().default([]),
  task: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional()
  }).optional(),
  validation: z.record(z.unknown()).optional().nullable(),
  evidence: taskEvidenceContextSchema.optional().nullable(),
  settlement: taskSettlementSchema.optional().nullable(),
  copy: z.string().optional(),
  allowedActions: reviewAllowedActionsSchema
}).passthrough();

const presentationModeSchema = z.enum(["game_master", "plain"]).catch("game_master");
const narrativeIntensitySchema = z.enum(["light", "standard", "immersive"]).catch("standard");
const statDisplayModeSchema = z.enum(["narrative", "numeric", "both"]).catch("both");

const gameMasterAllowedActionsSchema = z.object({
  createInvite: z.boolean().optional(),
  revokeInvite: z.boolean().optional(),
  joinFromInvite: z.boolean().optional(),
  launchQuest: z.boolean().optional(),
  updateQuestProfile: z.boolean().optional(),
  updateNarrativeSettings: z.boolean().optional(),
  updateCalling: z.boolean().optional()
}).partial().optional();

const narrativePreferencesSchema = z.object({
  presentationMode: presentationModeSchema,
  narrativeIntensity: narrativeIntensitySchema,
  preferredGenres: z.array(z.string()).default([]).catch([]),
  avoidThemes: z.array(z.string()).default([]).catch([]),
  statDisplayMode: statDisplayModeSchema,
  seenIntro: z.boolean().optional(),
  plainOverridePrefixes: z.array(z.string()).optional().default(["Game Master,", "Game Master:", "/plain"]),
  contentSafetyPreferences: z.record(z.unknown()).optional().default({}),
  updatedAt: z.string().optional().nullable()
}).passthrough();

const narrativeSettingsSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  presentationMode: presentationModeSchema,
  narrativeIntensity: narrativeIntensitySchema,
  genreOverride: z.string().optional().nullable(),
  avoidThemes: z.array(z.string()).optional().default([]),
  statDisplayMode: statDisplayModeSchema,
  spoilerLevel: z.string().optional(),
  safetyLevel: z.string().optional(),
  updatedAt: z.string().optional().nullable()
}).passthrough();

const questProfileSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  uuid: z.string().optional().nullable(),
  projectId: z.union([z.number(), z.string()]).optional(),
  status: z.string().optional(),
  version: z.number().optional(),
  title: z.string(),
  premise: z.string(),
  desiredOutcome: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  tone: z.string().optional().nullable(),
  stakes: z.string().optional().nullable(),
  openingScene: z.string().optional().nullable(),
  keyThemes: z.array(z.string()).optional().default([]),
  avoidedThemes: z.array(z.string()).optional().default([]),
  audience: z.string().optional(),
  source: z.record(z.unknown()).optional().default({}),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable()
}).passthrough();

const partyMemberSchema = z.object({
  userId: z.union([z.number(), z.string()]),
  username: z.string().optional(),
  profilePicture: z.string().optional().nullable(),
  isProjectCreator: z.boolean().optional(),
  calling: z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    uuid: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    roleArchetype: z.string().optional(),
    contributionSummary: z.string().optional().nullable(),
    status: z.string().optional(),
    source: z.string().optional()
  }).partial().optional()
}).passthrough();

const partySettingsSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  minPartySize: z.number().default(1),
  targetPartySize: z.number().default(3),
  maxPartySize: z.number().default(7),
  openRecruitment: z.boolean().default(true),
  inviteRequired: z.boolean().default(false),
  roleSlots: z.array(z.record(z.unknown())).optional().default([])
}).passthrough();

const projectInviteSchema = z.object({
  id: z.union([z.number(), z.string()]),
  uuid: z.string().optional().nullable(),
  projectId: z.union([z.number(), z.string()]).optional(),
  status: z.string(),
  maxUses: z.number().optional(),
  useCount: z.number().optional(),
  expiresAt: z.string().optional().nullable(),
  revokedAt: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  tokenHint: z.string().optional().nullable()
}).passthrough();

const characterCallingSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  uuid: z.string().optional().nullable(),
  projectId: z.union([z.number(), z.string()]).optional(),
  userId: z.union([z.number(), z.string()]).optional(),
  callingTitle: z.string().optional().nullable(),
  roleArchetype: z.string().optional(),
  contributionSummary: z.string().optional().nullable(),
  skillsSnapshot: z.record(z.unknown()).optional().default({}),
  status: z.string().optional(),
  source: z.string().optional(),
  joinedViaInviteId: z.union([z.number(), z.string()]).optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable()
}).passthrough();

const narrativeEventSchema = z.object({
  id: z.union([z.number(), z.string()]),
  uuid: z.string().optional().nullable(),
  projectId: z.union([z.number(), z.string()]).optional(),
  taskId: z.union([z.number(), z.string()]).optional().nullable(),
  reviewRoundId: z.union([z.number(), z.string()]).optional().nullable(),
  actorUserId: z.union([z.number(), z.string()]).optional().nullable(),
  type: z.string(),
  title: z.string(),
  body: z.string().optional().nullable(),
  facts: z.record(z.unknown()).optional().default({}),
  visibility: z.string().optional(),
  createdAt: z.string().optional().nullable()
}).passthrough();

const safeProjectSchema = z.object({
  id: z.number()
}).passthrough();

const narrativePreferencesResponseSchema = z.object({
  preferences: narrativePreferencesSchema
}).passthrough();

const questProfileResponseSchema = z.object({
  project: safeProjectSchema.optional(),
  profile: questProfileSchema.optional(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const questContextSchema = z.object({
  project: safeProjectSchema.optional(),
  questProfile: questProfileSchema.optional(),
  narrativeSettings: narrativeSettingsSchema.optional(),
  party: z.object({
    settings: partySettingsSchema.optional(),
    members: z.array(partyMemberSchema).optional().default([]),
    shortage: z.boolean().optional()
  }).partial().optional(),
  tasks: z.array(taskSchema).optional().default([]),
  review: z.object({
    activeRounds: z.array(taskReviewRoundSchema).optional().default([]),
    acceptedPendingSettlement: z.number().optional().default(0)
  }).partial().optional(),
  chronicle: z.array(narrativeEventSchema).optional().default([]),
  allowedActions: gameMasterAllowedActionsSchema,
  safety: z.record(z.unknown()).optional()
}).passthrough();

const narrativeSettingsResponseSchema = z.object({
  settings: narrativeSettingsSchema,
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const partyAssemblySchema = z.object({
  project: safeProjectSchema.optional(),
  settings: partySettingsSchema.optional(),
  members: z.array(partyMemberSchema).optional().default([]),
  invites: z.array(projectInviteSchema).optional().default([]),
  shortage: z.boolean().optional(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const inviteCreateResponseSchema = z.object({
  invite: projectInviteSchema,
  token: z.string().optional(),
  inviteUrl: z.string().optional().nullable(),
  warning: z.string().optional(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const invitePreviewResponseSchema = z.object({
  invite: projectInviteSchema,
  project: safeProjectSchema.optional(),
  allowedActions: z.object({ redeem: z.boolean().optional() }).partial().optional(),
  status: z.string(),
  unavailableReason: z.string().optional().nullable()
}).passthrough();

const inviteRedeemResponseSchema = z.object({
  projectId: z.union([z.number(), z.string()]).optional(),
  calling: characterCallingSchema.optional(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const callingResponseSchema = z.object({
  project: safeProjectSchema.optional(),
  calling: characterCallingSchema.optional().nullable(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const launchPreviewResponseSchema = z.object({
  canLaunch: z.boolean(),
  missing: z.array(z.object({ field: z.string(), message: z.string() })).optional().default([]),
  openingScene: z.string().optional().nullable(),
  firstEncounters: z.array(taskSchema).optional().default([]),
  action: cerbanimoActionSchema.optional(),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const chronicleResponseSchema = z.object({
  project: safeProjectSchema.optional(),
  events: z.array(narrativeEventSchema).default([]),
  allowedActions: gameMasterAllowedActionsSchema
}).passthrough();

const automationRunSchema = z.object({
  id: z.union([z.number(), z.string()]),
  run_uuid: z.string().optional().nullable(),
  action_id: z.union([z.number(), z.string()]).optional().nullable(),
  preparation_id: z.union([z.number(), z.string()]).optional().nullable(),
  template_key: z.string().optional(),
  status: z.string(),
  input: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional().nullable(),
  allowedActions: z.object({
    cancel: z.boolean().optional(),
    retry: z.boolean().optional(),
    startNewRun: z.boolean().optional()
  }).optional(),
  logs: z.array(z.object({
    level: z.string().optional(),
    message: z.string().optional(),
    payload: z.unknown().optional(),
    created_at: z.string().optional().nullable()
  }).passthrough()).default([]).optional(),
  created_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable()
}).passthrough();

const defaultRequestTimeoutMs = 15_000;

export function normalizeCerbanimoApiUrl(
  value: string | undefined,
  options: { allowLoopback?: boolean; allowedOrigins?: string[] } = {}
): string {
  if (!value) return "";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return "";
  const hostname = parsed.hostname.toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
  const allowedOrigins = new Set((options.allowedOrigins || []).flatMap(origin => {
    try { return [new URL(origin).origin]; } catch { return []; }
  }));
  if (options.allowLoopback && loopback) return parsed.toString().replace(/\/$/, "");
  if (parsed.protocol === 'https:' && allowedOrigins.has(parsed.origin)) return parsed.toString().replace(/\/$/, "");
  return "";
}

export class CerbanimoClient {
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly auth: KamiyaAuthContext;

  constructor(auth: KamiyaAuthContext) {
    this.auth = auth;
    const configuredApiUrl = process.env.KAMIYA_CERBANIMO_API_URL || "";
    const configuredOrigin = (() => {
      try { return configuredApiUrl ? new URL(configuredApiUrl).origin : ""; } catch { return ""; }
    })();
    const allowedOrigins = [
      configuredOrigin,
      ...(process.env.KAMIYA_CERBANIMO_ALLOWED_ORIGINS || "").split(',').map(value => value.trim())
    ].filter(Boolean);
    this.apiUrl = normalizeCerbanimoApiUrl(configuredApiUrl || auth.cerbanimoApiUrl, {
      allowLoopback: process.env.NODE_ENV !== 'production',
      allowedOrigins
    });
    this.token = auth.cerbanimoToken || process.env.KAMIYA_CERBANIMO_BEARER_TOKEN;
  }

  async previewProjectBootstrap(action: ActionPreview): Promise<CerbanimoResult<{
    action: CerbanimoAction;
    preview: ActionPreview;
    activeAction: ActiveCerbanimoActionState;
  }>> {
    if (!this.hasUserToken()) return this.missingUserAuthResult("prepare a Cerbanimo project preview");
    const bootstrapArguments = {
      name: action.payload.name,
      description: action.payload.description,
      outcomeStatement: action.payload.outcomeStatement,
      dueDate: action.payload.dueDate ?? action.payload.due_date ?? null,
      tags: action.payload.tags ?? [],
      generationMode: action.payload.generationMode ?? "plan_then_tasks",
      autoAssign: action.payload.auto_assign ?? false,
      location: action.payload.location ?? null,
      isService: action.payload.is_service ?? false,
      serviceVisibility: action.payload.service_visibility ?? ["private"],
      servicePrice: action.payload.service_price ?? 0,
      ...e2eBootstrapArguments(action.payload)
    };

    const result = await this.previewAction({
      intent: {
        functionName: "projects.bootstrap",
        arguments: bootstrapArguments
      },
      previewPayload: {
        title: action.title,
        summary: action.summary,
        project: {
          name: action.payload.name,
          description: action.payload.description,
          outcomeStatement: action.payload.outcomeStatement,
          dueDate: action.payload.dueDate ?? action.payload.due_date ?? null,
          tags: action.payload.tags ?? []
        },
        effects: [
          "Generate a project plan",
          "Generate and validate a task dependency graph",
          "Persist the project, outcome, tasks, and impact nodes atomically",
          "Activate root tasks once dependencies are clear"
        ],
        confirmationRequired: true,
        permissions: action.requiredPermissions
      },
      sourceClient: "kamiya-web",
      riskLevel: action.risk
    });

    if (!result.ok || !result.data) return result as CerbanimoResult<never>;

    const persistedAction = result.data;
    const preview = {
      ...action,
      cerbanimoActionId: String(persistedAction.id),
      cerbanimoActionUuid: persistedAction.action_uuid ?? undefined,
      requestId: result.requestId,
      functionName: "projects.bootstrap"
    };

    return {
      ok: true,
      data: {
        action: persistedAction,
        preview,
        activeAction: this.activeStateFromAction(persistedAction, result.requestId)
      },
      requestId: result.requestId
    };
  }

  async previewAction(body: {
    intent: Record<string, unknown>;
    previewPayload?: Record<string, unknown>;
    sourceClient?: string;
    riskLevel?: string;
  }): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1("/actions/preview", "POST", body, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async confirmAction(actionId: string | number): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/confirm`, "POST", { confirmedBy: "kamiya" }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async getActionDetail(actionId: string | number): Promise<CerbanimoResult<ProjectBootstrapActionDetail>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}`, "GET", undefined, projectBootstrapActionDetailSchema) as Promise<CerbanimoResult<ProjectBootstrapActionDetail>>;
  }

  async cancelAction(actionId: string | number, reason = "Cancelled from Kamiya."): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/cancel`, "POST", { reason }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async retryAction(actionId: string | number, reason = "Retried from Kamiya."): Promise<CerbanimoResult<CerbanimoAction>> {
    return this.requestV1(`/actions/${encodeURIComponent(String(actionId))}/retry`, "POST", { reason }, cerbanimoActionSchema) as Promise<CerbanimoResult<CerbanimoAction>>;
  }

  async listActions(input: { limit?: number; status?: string } = {}): Promise<CerbanimoResult<{ actions: CerbanimoAction[] }>> {
    const params = new URLSearchParams();
    if (input.limit) params.set("limit", String(input.limit));
    if (input.status) params.set("status", input.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.requestV1(`/actions${suffix}`, "GET", undefined, z.object({ actions: z.array(cerbanimoActionSchema) })) as Promise<CerbanimoResult<{ actions: CerbanimoAction[] }>>;
  }

  async getTaskAutomation(taskId: string | number): Promise<CerbanimoResult<TaskAutomationContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/automation`,
      "GET",
      undefined,
      taskAutomationContextSchema
    ) as Promise<CerbanimoResult<TaskAutomationContext>>;
  }

  async createTaskAutomationPreparation(
    taskId: string | number,
    input: { capabilityName?: string | null; inputValues?: Record<string, unknown> }
  ): Promise<CerbanimoResult<TaskAutomationContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/automation/preparations`,
      "POST",
      input,
      taskAutomationContextSchema
    ) as Promise<CerbanimoResult<TaskAutomationContext>>;
  }

  async validateTaskAutomationPreparation(taskId: string | number, preparationId: string | number): Promise<CerbanimoResult<TaskAutomationContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/automation/preparations/${encodeURIComponent(String(preparationId))}/validate`,
      "POST",
      {},
      taskAutomationContextSchema
    ) as Promise<CerbanimoResult<TaskAutomationContext>>;
  }

  async previewTaskAutomationPreparation(taskId: string | number, preparationId: string | number): Promise<CerbanimoResult<TaskAutomationContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/automation/preparations/${encodeURIComponent(String(preparationId))}/preview`,
      "POST",
      { sourceClient: "kamiya-web" },
      taskAutomationContextSchema
    ) as Promise<CerbanimoResult<TaskAutomationContext>>;
  }

  async taskEvidence(taskId: string | number): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence`,
      "GET",
      undefined,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async createEvidenceBundle(
    taskId: string | number,
    input: { reflection?: string; summary?: string; sourceKind?: string } = {}
  ): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles`,
      "POST",
      input,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async updateEvidenceBundle(
    taskId: string | number,
    bundleId: string | number,
    input: { reflection?: string; summary?: string; sourceKind?: string }
  ): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}`,
      "PATCH",
      input,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async addEvidenceItem(
    taskId: string | number,
    bundleId: string | number,
    item: Record<string, unknown>
  ): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}/items`,
      "POST",
      item,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async fetchEvidenceUrl(
    taskId: string | number,
    bundleId: string | number,
    input: { url: string; requirementIds?: string[]; title?: string }
  ): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}/fetch-url`,
      "POST",
      input,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async previewEvidenceBundle(taskId: string | number, bundleId: string | number): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}/preview`,
      "POST",
      { sourceClient: "kamiya-web" },
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async cancelEvidenceBundle(taskId: string | number, bundleId: string | number, reason = "Cancelled from Kamiya."): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}/cancel`,
      "POST",
      { reason },
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async supersedeEvidenceBundle(
    taskId: string | number,
    bundleId: string | number,
    input: { reflection?: string; summary?: string } = {}
  ): Promise<CerbanimoResult<TaskEvidenceContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/evidence/bundles/${encodeURIComponent(String(bundleId))}/supersede`,
      "POST",
      input,
      taskEvidenceContextSchema
    ) as Promise<CerbanimoResult<TaskEvidenceContext>>;
  }

  async taskReviewStatus(taskId: string | number): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/review-status`,
      "GET",
      undefined,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async listReviewAssignments(): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      "/reviews/assignments",
      "GET",
      undefined,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async getReviewAssignment(assignmentId: string | number): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/reviews/assignments/${encodeURIComponent(String(assignmentId))}`,
      "GET",
      undefined,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async acceptReviewAssignment(assignmentId: string | number): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/reviews/assignments/${encodeURIComponent(String(assignmentId))}/accept`,
      "POST",
      {},
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async declineReviewAssignment(assignmentId: string | number, reason?: string): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/reviews/assignments/${encodeURIComponent(String(assignmentId))}/decline`,
      "POST",
      { reason },
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async recuseReviewAssignment(assignmentId: string | number, reason: string): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/reviews/assignments/${encodeURIComponent(String(assignmentId))}/recuse`,
      "POST",
      { reason },
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async decideValidationReview(
    reviewId: string | number,
    input: { decision: string; reason?: string; requirementFindings?: Array<Record<string, unknown>> }
  ): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/validation-reviews/${encodeURIComponent(String(reviewId))}/decision`,
      "POST",
      input,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async decidePeerReview(
    roundId: string | number,
    input: { assignmentId?: string | number; decision: string; reason?: string; requirementFindings?: Array<Record<string, unknown>> }
  ): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/review-rounds/${encodeURIComponent(String(roundId))}/peer-decisions`,
      "POST",
      input,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async decidePmReview(
    roundId: string | number,
    input: { assignmentId?: string | number; decision: string; reason?: string; requirementFindings?: Array<Record<string, unknown>> }
  ): Promise<CerbanimoResult<TaskReviewContext>> {
    return this.requestV1(
      `/review-rounds/${encodeURIComponent(String(roundId))}/pm-decisions`,
      "POST",
      input,
      taskReviewContextSchema
    ) as Promise<CerbanimoResult<TaskReviewContext>>;
  }

  async taskSettlement(taskId: string | number): Promise<CerbanimoResult<TaskSettlementContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/settlement`,
      "GET",
      undefined,
      taskSettlementSchema
    ) as Promise<CerbanimoResult<TaskSettlementContext>>;
  }

  async getSettlement(settlementId: string | number): Promise<CerbanimoResult<TaskSettlementContext>> {
    return this.requestV1(
      `/settlements/${encodeURIComponent(String(settlementId))}`,
      "GET",
      undefined,
      taskSettlementSchema
    ) as Promise<CerbanimoResult<TaskSettlementContext>>;
  }

  async previewTaskSettlement(taskId: string | number): Promise<CerbanimoResult<TaskSettlementContext>> {
    return this.requestV1(
      `/tasks/${encodeURIComponent(String(taskId))}/settlement/preview`,
      "POST",
      { sourceClient: "kamiya-web" },
      taskSettlementSchema
    ) as Promise<CerbanimoResult<TaskSettlementContext>>;
  }

  async retrySettlement(settlementId: string | number): Promise<CerbanimoResult<TaskSettlementContext>> {
    return this.requestV1(
      `/settlements/${encodeURIComponent(String(settlementId))}/retry`,
      "POST",
      {},
      taskSettlementSchema
    ) as Promise<CerbanimoResult<TaskSettlementContext>>;
  }

  async cancelSettlement(settlementId: string | number, reason = "Cancelled from Kamiya."): Promise<CerbanimoResult<TaskSettlementContext>> {
    return this.requestV1(
      `/settlements/${encodeURIComponent(String(settlementId))}/cancel`,
      "POST",
      { reason },
      taskSettlementSchema
    ) as Promise<CerbanimoResult<TaskSettlementContext>>;
  }

  async getAutomationRun(runId: string | number): Promise<CerbanimoResult<AutomationRun>> {
    return this.requestV1(
      `/automation/runs/${encodeURIComponent(String(runId))}`,
      "GET",
      undefined,
      automationRunSchema
    ) as Promise<CerbanimoResult<AutomationRun>>;
  }

  async getNarrativePreferences(): Promise<CerbanimoResult<NarrativePreferencesResponse>> {
    return this.requestV1(
      "/me/narrative-preferences",
      "GET",
      undefined,
      narrativePreferencesResponseSchema
    ) as Promise<CerbanimoResult<NarrativePreferencesResponse>>;
  }

  async updateNarrativePreferences(input: Record<string, unknown>): Promise<CerbanimoResult<NarrativePreferencesResponse>> {
    return this.requestV1(
      "/me/narrative-preferences",
      "PATCH",
      input,
      narrativePreferencesResponseSchema
    ) as Promise<CerbanimoResult<NarrativePreferencesResponse>>;
  }

  async getQuestProfile(projectId: string | number): Promise<CerbanimoResult<QuestProfileResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/quest-profile`,
      "GET",
      undefined,
      questProfileResponseSchema
    ) as Promise<CerbanimoResult<QuestProfileResponse>>;
  }

  async getQuestContext(projectId: string | number): Promise<CerbanimoResult<QuestContext>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/quest-context`,
      "GET",
      undefined,
      questContextSchema
    ) as Promise<CerbanimoResult<QuestContext>>;
  }

  async updateNarrativeSettings(projectId: string | number, input: Record<string, unknown>): Promise<CerbanimoResult<NarrativeSettingsResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/narrative-settings`,
      "PATCH",
      input,
      narrativeSettingsResponseSchema
    ) as Promise<CerbanimoResult<NarrativeSettingsResponse>>;
  }

  async previewQuestProfileUpdate(projectId: string | number, input: Record<string, unknown>): Promise<CerbanimoResult<{ proposedProfile?: Record<string, unknown>; action?: CerbanimoAction }>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/quest-profile/preview-update`,
      "POST",
      { ...input, sourceClient: "kamiya-web" },
      z.object({
        proposedProfile: z.record(z.unknown()).optional(),
        action: cerbanimoActionSchema.optional(),
        allowedActions: gameMasterAllowedActionsSchema
      }).passthrough()
    ) as Promise<CerbanimoResult<{ proposedProfile?: Record<string, unknown>; action?: CerbanimoAction }>>;
  }

  async getParty(projectId: string | number): Promise<CerbanimoResult<PartyAssemblyContext>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/party`,
      "GET",
      undefined,
      partyAssemblySchema
    ) as Promise<CerbanimoResult<PartyAssemblyContext>>;
  }

  async createProjectInvite(projectId: string | number, input: { maxUses?: number; expiresInHours?: number } = {}): Promise<CerbanimoResult<InviteCreateResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/invites`,
      "POST",
      input,
      inviteCreateResponseSchema
    ) as Promise<CerbanimoResult<InviteCreateResponse>>;
  }

  async revokeProjectInvite(projectId: string | number, inviteId: string | number, reason?: string): Promise<CerbanimoResult<{ invite: InviteCreateResponse["invite"] }>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/invites/${encodeURIComponent(String(inviteId))}/revoke`,
      "POST",
      { reason },
      z.object({ invite: projectInviteSchema, allowedActions: gameMasterAllowedActionsSchema }).passthrough()
    ) as Promise<CerbanimoResult<{ invite: InviteCreateResponse["invite"] }>>;
  }

  async previewProjectInvite(token: string): Promise<CerbanimoResult<InvitePreviewResponse>> {
    return this.requestV1(
      `/project-invites/${encodeURIComponent(token)}/preview`,
      "GET",
      undefined,
      invitePreviewResponseSchema
    ) as Promise<CerbanimoResult<InvitePreviewResponse>>;
  }

  async redeemProjectInvite(token: string): Promise<CerbanimoResult<InviteRedeemResponse>> {
    return this.requestV1(
      `/project-invites/${encodeURIComponent(token)}/redeem`,
      "POST",
      {},
      inviteRedeemResponseSchema
    ) as Promise<CerbanimoResult<InviteRedeemResponse>>;
  }

  async launchQuestPreview(projectId: string | number): Promise<CerbanimoResult<LaunchPreviewResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/launch/preview`,
      "POST",
      {},
      launchPreviewResponseSchema
    ) as Promise<CerbanimoResult<LaunchPreviewResponse>>;
  }

  async getCalling(projectId: string | number): Promise<CerbanimoResult<CallingResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/calling`,
      "GET",
      undefined,
      callingResponseSchema
    ) as Promise<CerbanimoResult<CallingResponse>>;
  }

  async updateCalling(projectId: string | number, input: Record<string, unknown>): Promise<CerbanimoResult<CallingResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/calling`,
      "PATCH",
      input,
      callingResponseSchema
    ) as Promise<CerbanimoResult<CallingResponse>>;
  }

  async getChronicle(projectId: string | number): Promise<CerbanimoResult<ChronicleResponse>> {
    return this.requestV1(
      `/projects/${encodeURIComponent(String(projectId))}/chronicle`,
      "GET",
      undefined,
      chronicleResponseSchema
    ) as Promise<CerbanimoResult<ChronicleResponse>>;
  }

  async executeAction(action: ActionPreview): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: false,
        error: `Kamiya cannot execute "${action.title}" yet because Cerbanimo API credentials are not configured on the backend. Set ${this.apiUrl ? "" : "KAMIYA_CERBANIMO_API_URL"}${!this.apiUrl && !this.token ? " and " : ""}${this.token ? "" : "KAMIYA_CERBANIMO_BEARER_TOKEN"} in the server environment, then restart Kamiya. The action preview is still safe and no Cerbanimo data was modified.`
      };
    }

    if (action.kind === "create_project") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      if (!actionId) {
        return {
          ok: false,
          error: "Kamiya cannot confirm this quest because Cerbanimo did not return a persisted action preview. Refresh the draft and try again."
        };
      }
      const confirmed = await this.confirmAction(actionId);
      if (!confirmed.ok) return confirmed;
      const detail = await this.getActionDetail(actionId);
      return detail.ok ? { ...detail, data: { detail: detail.data, action: confirmed.data } } : detail;
    }

    if (action.kind === "submit_task") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      if (!actionId) {
        return {
          ok: false,
          error: "Kamiya cannot submit this task because Cerbanimo did not return an evidence action preview. Add evidence and preview the submission again."
        };
      }
      const confirmed = await this.confirmAction(actionId);
      if (!confirmed.ok || !confirmed.data) return confirmed;
      const runId = confirmed.data.related_automation_run_id ?? automationRunIdFromExecutionResult(confirmed.data.execution_result);
      if (!runId) {
        return { ok: true, data: { action: confirmed.data }, requestId: confirmed.requestId };
      }
      const run = await this.hydrateAutomationRunAfterConfirm(runId);
      return run.ok
        ? { ok: true, data: { action: confirmed.data, automationRun: run.data }, requestId: run.requestId ?? confirmed.requestId }
        : { ok: true, data: { action: confirmed.data, automationRunError: run.error }, requestId: confirmed.requestId };
    }

    if (action.kind === "run_automation") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      if (actionId) {
        const confirmed = await this.confirmAction(actionId);
        if (!confirmed.ok || !confirmed.data) return confirmed;
        const runId = confirmed.data.related_automation_run_id ?? automationRunIdFromExecutionResult(confirmed.data.execution_result);
        if (!runId) {
          return {
            ok: true,
            data: { action: confirmed.data },
            requestId: confirmed.requestId
          };
        }

        const run = await this.hydrateAutomationRunAfterConfirm(runId);
        return run.ok
          ? { ok: true, data: { action: confirmed.data, automationRun: run.data }, requestId: run.requestId ?? confirmed.requestId }
          : { ok: true, data: { action: confirmed.data, automationRunError: run.error }, requestId: confirmed.requestId };
      }
      return this.request("/automation/actions", "POST", action.payload);
    }

    if (action.kind === "settle_task") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      const settlementId = action.payload.settlementId;
      if (!actionId || (typeof settlementId !== "string" && typeof settlementId !== "number")) {
        return {
          ok: false,
          error: "Kamiya cannot confirm this settlement because Cerbanimo did not return both the durable action and settlement identifiers."
        };
      }
      const confirmed = await this.confirmAction(actionId);
      if (!confirmed.ok) return confirmed;
      const settlement = await this.getSettlement(settlementId);
      return settlement.ok
        ? { ok: true, data: { action: confirmed.data, settlement: settlement.data }, requestId: settlement.requestId ?? confirmed.requestId }
        : settlement;
    }

    if (action.kind === "game_master") {
      const actionId = action.cerbanimoActionUuid ?? action.cerbanimoActionId;
      if (!actionId) {
        return {
          ok: false,
          error: "Kamiya cannot confirm this Game Master action because Cerbanimo did not return a persisted action preview."
        };
      }
      const confirmed = await this.confirmAction(actionId);
      return confirmed.ok
        ? { ok: true, data: { action: confirmed.data }, requestId: confirmed.requestId }
        : confirmed;
    }

    return {
      ok: false,
      error: `No Cerbanimo execution mapping exists for ${action.kind}`
    };
  }

  async saveChat(input: {
    chatId?: number;
    name: string;
    messages: ChatMessage[];
    session: KamiyaSessionState;
  }): Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request("/kamiya/chats", "POST", input) as Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>>;
  }

  async listChats(): Promise<CerbanimoResult<{ chats: KamiyaSavedChatSummary[] }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request("/kamiya/chats", "GET") as Promise<CerbanimoResult<{ chats: KamiyaSavedChatSummary[] }>>;
  }

  async loadChat(chatId: number): Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo chat storage is not configured." };
    }

    return this.request(`/kamiya/chats/${encodeURIComponent(String(chatId))}`, "GET") as Promise<CerbanimoResult<{ chat: KamiyaSavedChat }>>;
  }

  async search(query: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "task-landing-page", title: "Landing Page Polish", type: "task", status: "open" },
          { id: "project-cerbanimo", title: "Cerbanimo", type: "project", status: "active" },
          { id: "community-builders", title: "Builders Guild", type: "community", status: "open" }
        ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query.trim().length < 4)
      };
    }

    return this.request(`/search?q=${encodeURIComponent(query)}`, "GET");
  }

  async tasks(query = ""): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          {
            id: "task-kamiya-router",
            title: "Harden Kamiya intent router",
            type: "task",
            status: "active",
            project: "Kamiya",
            reward: 35
          },
          {
            id: "task-community-search",
            title: "Wire community search cards",
            type: "task",
            status: "open",
            project: "Cerbanimo",
            reward: 20
          },
          {
            id: "task-approval-copy",
            title: "Review approval notification tone",
            type: "task",
            status: "review",
            project: "Kamiya",
            reward: 15
          }
        ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || query.trim().length < 4)
      };
    }

    return this.request(`/tasks?query=${encodeURIComponent(query)}`, "GET");
  }

  async profile(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          displayName: "Glaed",
          level: 7,
          title: "Quest Architect",
          skills: ["planning", "frontend", "automation"],
          activeProjects: 3,
          completedTasks: 18,
          tokens: 420
        }
      };
    }

    return this.request("/profile/me", "GET");
  }

  async notifications(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "notice-task-approved", title: "Task approved", status: "new", body: "Your submitted task was approved." },
          { id: "notice-level", title: "Level gained", status: "new", body: "You reached Level 7." },
          { id: "notice-tokens", title: "Tokens received", status: "seen", body: "You received 35 tokens." }
        ]
      };
    }

    return this.request("/notifications", "GET");
  }

  async automationTemplates(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          { id: "research_competitors", title: "Research competitors", status: "available", permission: "automation:create" },
          { id: "generate_project_plan", title: "Generate project plan", status: "available", permission: "automation:create" },
          { id: "create_github_issues", title: "Create GitHub issues", status: "needs GitHub", permission: "integrations:github" },
          { id: "review_pull_request", title: "Review pull request", status: "needs GitHub", permission: "integrations:github" },
          { id: "run_quality_checks", title: "Run quality checks", status: "available", permission: "automation:create" },
          { id: "validate_submission", title: "Validate submitted work", status: "available", permission: "tasks:review" }
        ]
      };
    }

    return this.request("/automation/templates", "GET");
  }

  async actionQueue(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: [
          {
            id: "action-deadline-monitor",
            title: "Monitor deadline risk",
            status: "running",
            summary: "Watching active Kamiya tasks for due-date risk."
          },
          {
            id: "action-quality-check",
            title: "Run quality checks",
            status: "queued",
            summary: "Waiting for repository connection."
          }
        ]
      };
    }

    return this.listActions({ limit: 20 });
  }

  async validationReport(target: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          title: "Validation report",
          target: target || "latest submission",
          status: "ready",
          checks: [
            { id: "proof", title: "Proof attached", status: "passed" },
            { id: "requirements", title: "Requirements matched", status: "needs review" },
            { id: "quality", title: "Quality checks", status: "queued" }
          ]
        }
      };
    }

    return this.request(`/automation/validation-report?target=${encodeURIComponent(target)}`, "GET");
  }

  async renderPage(target: string): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          target,
          title: target ? `Open ${target}` : "Open Cerbanimo",
          url: `${this.apiUrl || "http://localhost:4000"}/${target.replace(/^\/+/, "") || "dashboard"}`,
          type: "navigation"
        }
      };
    }

    return this.request(`/render/page?target=${encodeURIComponent(target)}`, "GET");
  }

  async stats(): Promise<CerbanimoResult> {
    if (!this.apiUrl || !this.token) {
      return {
        ok: true,
        mocked: true,
        data: {
          level: 7,
          experience: 1840,
          tokens: 420,
          streak: 5,
          activeProjects: 3,
          completedTasks: 18
        }
      };
    }

    return this.request("/profile/stats", "GET");
  }

  private async requestV1<T>(path: string, method: string, body?: unknown, schema?: z.ZodType<T>): Promise<CerbanimoResult<T>> {
    if (!this.apiUrl || !this.token) {
      return { ok: false, error: "Cerbanimo API credentials are not configured." };
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const v1Path = normalizedPath.startsWith("/api/v1/") ? normalizedPath : `/api/v1${normalizedPath}`;
    return this.requestRaw(`${this.apiUrl}${v1Path}`, method, body, schema, true);
  }

  private async request(path: string, method: string, body?: unknown): Promise<CerbanimoResult> {
    return this.requestRaw(`${this.apiUrl}${path}`, method, body);
  }

  private async requestRaw<T>(
    url: string,
    method: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    requireContractIdentity = false
  ): Promise<CerbanimoResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.KAMIYA_CERBANIMO_TIMEOUT_MS ?? defaultRequestTimeoutMs));

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json"
        },
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        error: isAbort ? "Cerbanimo request timed out." : error instanceof Error ? error.message : "Cerbanimo request failed.",
        code: isAbort ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        retryable: true
      };
    } finally {
      clearTimeout(timeout);
    }

    if (requireContractIdentity) {
      const compatibility = checkCerbanimoContractIdentity(
        response.headers?.get("x-cerbanimo-contract-version"),
        response.headers?.get("x-cerbanimo-contract-digest")
      );
      if (!compatibility.compatible) {
        return {
          ok: false,
          error: compatibility.reason,
          code: "CONTRACT_INCOMPATIBLE",
          status: response.status,
          requestId: response.headers?.get("x-request-id") ?? undefined,
          retryable: false
        };
      }
    }

    const data = await response.json().catch(() => undefined);
    const envelope = apiEnvelopeSchema.safeParse(data);
    const requestId = response.headers?.get("x-request-id") ?? (envelope.success ? envelope.data.requestId : undefined);

    if (!response.ok) {
      const errorPayload = envelope.success ? envelope.data.error : data;
      return {
        ok: false,
        error: errorMessageFromResponse(errorPayload, response),
        code: errorCodeFromResponse(errorPayload, response),
        status: response.status,
        requestId,
        retryable: response.status >= 500 || response.status === 408 || response.status === 429
      };
    }

    const payload = envelope.success ? envelope.data.data : data;
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        return {
          ok: false,
          error: `Cerbanimo response did not match the expected contract: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")}`,
          code: "CONTRACT_PARSE_FAILED",
          status: response.status,
          requestId
        };
      }
      return { ok: true, data: parsed.data, status: response.status, requestId };
    }

    return { ok: true, data: payload as T, status: response.status, requestId };
  }

  private hasUserToken(): boolean {
    return Boolean(this.apiUrl && this.auth.isLoggedIn && this.auth.cerbanimoToken);
  }

  private async hydrateAutomationRunAfterConfirm(runId: string | number): Promise<CerbanimoResult<AutomationRun>> {
    const pollMs = Number(process.env.KAMIYA_AUTOMATION_CONFIRM_POLL_MS || 0);
    if (pollMs <= 0) return this.getAutomationRun(runId);

    const terminalStatuses = new Set(["completed", "failed", "blocked", "cancelled"]);
    const deadline = Date.now() + pollMs;
    let lastResult: CerbanimoResult<AutomationRun> | undefined;

    while (Date.now() <= deadline) {
      lastResult = await this.getAutomationRun(runId);
      if (!lastResult.ok || terminalStatuses.has(String(lastResult.data?.status))) {
        return lastResult;
      }
      await delay(300);
    }

    return lastResult ?? this.getAutomationRun(runId);
  }

  private missingUserAuthResult(actionDescription: string): CerbanimoResult<never> {
    return {
      ok: false,
      error: `Kamiya cannot ${actionDescription} because you are not connected to Cerbanimo with a user-scoped Auth0 token. Log in through the Cerbanimo bridge, then try again.`,
      code: "AUTH_REQUIRED",
      status: 401
    };
  }

  private activeStateFromAction(action: CerbanimoAction, requestId?: string): ActiveCerbanimoActionState {
    return {
      actionId: String(action.id),
      actionUuid: action.action_uuid ?? undefined,
      functionName: "projects.bootstrap",
      status: normalizeActionStatus(action.status),
      projectId: action.related_project_id ?? undefined,
      startedAt: action.created_at ?? new Date().toISOString(),
      lastHydratedAt: new Date().toISOString(),
      requestId
    };
  }

}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessageFromResponse(data: unknown, response: Response): string {
  if (isRecord(data)) {
    for (const key of ["message", "error", "detail"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value;
      if (isRecord(value)) return JSON.stringify(value);
    }
    return JSON.stringify(data);
  }

  if (typeof data === "string" && data.trim()) return data;
  return `${response.status} ${response.statusText}`;
}

function errorCodeFromResponse(data: unknown, response: Response): string | number {
  if (isRecord(data)) {
    const code = data.code ?? data.status;
    if (typeof code === "string" || typeof code === "number") return code;
  }
  return response.status;
}

function normalizeActionStatus(status: unknown): ActiveCerbanimoActionState["status"] {
  const value = String(status ?? "previewed");
  if (
    value === "previewed" ||
    value === "confirmed" ||
    value === "queued" ||
    value === "running" ||
    value === "retry_wait" ||
    value === "blocked" ||
    value === "failed" ||
    value === "completed" ||
    value === "executed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "confirmed";
}

function e2eBootstrapArguments(payload: Record<string, unknown>): Record<string, unknown> {
  if (process.env.KAMIYA_REAL_STACK_E2E !== "1") return {};
  return {
    e2eScenario: payload._e2eScenario,
    e2eRunId: payload._e2eRunId,
    e2eControlDir: payload._e2eControlDir
  };
}

function automationRunIdFromExecutionResult(value: unknown): number | string | undefined {
  if (!isRecord(value)) return undefined;
  const runId = value.automationRunId ?? value.automation_run_id;
  return typeof runId === "number" || typeof runId === "string" ? runId : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
