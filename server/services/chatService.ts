import type {
  ActiveCerbanimoActionState,
  ChatMessage,
  ChatTurnRequest,
  ChatTurnResponse,
  ProjectBootstrapActionDetail
} from "../../shared/types";
import { matchSlashCommand } from "../../shared/commands";
import {
  actionPreviewCard,
  actionQueueCard,
  automationTemplatesCard,
  activeTaskCard,
  integrationCard,
  helpCard,
  navigationCard,
  notificationCard,
  projectResultCards,
  profileCard,
  questSummaryCard,
  searchResultsCard,
  statsCard,
  taskListCard,
  validationReportCard,
  modeCard,
  workflowFailureCard,
  workflowProgressCard
} from "./cardFactory";
import { CerbanimoClient } from "./cerbanimoClient";
import { previewAutomation, previewProjectCreation, previewTaskSubmission } from "./actionPlanner";
import { routeIntent } from "./intentRouter";
import { analyzePlanning } from "./planningService";
import { parseModeCommand, shouldShowModes } from "./modeService";
import { generateChatName } from "./chatTitleService";

export async function handleChatTurn(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const response = await buildChatTurnResponse(request);
  return persistChatTurn(request, response);
}

async function buildChatTurnResponse(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const message = request.message.trim();
  const actionCommand = parseDurableActionCommand(message);

  if (request.session.pendingAction && isConfirmation(message)) {
    return executePendingAction(request);
  }

  if (actionCommand?.verb === "retry") {
    return retryDurableAction(request, actionCommand.actionId);
  }

  if (actionCommand?.verb === "cancel") {
    return cancelDurableAction(request, actionCommand.actionId);
  }

  if (/^explore active tasks\b/i.test(message) && request.session.activeAction?.actionId) {
    const detail = await new CerbanimoClient(request.auth).getActionDetail(request.session.activeAction.actionUuid ?? request.session.activeAction.actionId);
    if (!detail.ok || !detail.data) return respond(`I could not refresh active tasks from Cerbanimo: ${detail.error}`, request.session);
    return respond("Here are the active tasks Cerbanimo says can begin now.", {
      ...request.session,
      activeAction: activeStateFromDetail(detail.data, detail.requestId)
    }, undefined, [activeTaskCard(detail.data.activeTasks)]);
  }

  if (request.session.pendingAction && isCancel(message)) {
    const actionId = request.session.pendingAction.cerbanimoActionUuid ?? request.session.pendingAction.cerbanimoActionId;
    if (actionId) return cancelDurableAction(request, actionId);
    return respond("All set. I cancelled that pending action.", {
      ...request.session,
      pendingAction: undefined,
      planningDeadlinePrompted: undefined
    });
  }

  const intent = await routeIntent(request);
  const cerbanimo = new CerbanimoClient(request.auth);
  const activeMode = request.session.mode ?? "auto";

  if (intent.next_action === "show_modes" || shouldShowModes(message)) {
    const requestedMode = parseModeCommand(message);
    if (requestedMode) {
      return respond(`Mode switched to ${requestedMode}.`, { ...request.session, mode: requestedMode }, intent, [modeCard(requestedMode)]);
    }

    return respond("Here are Kamiya's operating modes.", request.session, intent, [modeCard(activeMode)]);
  }

  if (intent.next_action === "show_settings" || matchSlashCommand(message)?.name === "/settings") {
    return respond("Open settings to connect Kamiya to your Cerbanimo API URL and bearer token.", request.session, intent);
  }

  if (intent.next_action === "show_help") {
    return respond("Here are the paths I can take with you.", request.session, intent, [helpCard(), modeCard(activeMode), integrationCard()]);
  }

  if (isProjectPlanningTurn(message, intent, request.session.planningDraft)) {
    const analysis = await analyzePlanning(message, request.session.planningDraft);
    if (!analysis.ready_to_create) {
      const question = analysis.recommended_next_questions[0] ?? "What detail should I add next?";
      return respond(
        `I can help create that project, but I need one more concrete detail before I can prepare the Cerbanimo action preview. ${question}`,
        { ...request.session, planningDraft: analysis.draft, planningDeadlinePrompted: undefined },
        intent,
        [questSummaryCard(analysis.draft)]
      );
    }

    if (!analysis.draft.timeline && !request.session.planningDeadlinePrompted) {
      return respond(
        "I have the required Cerbanimo fields. Do you want to set a deadline before I create it? You can say a date like \"next month\" or \"by August 15\", or say \"no deadline\".",
        { ...request.session, planningDraft: analysis.draft, planningDeadlinePrompted: true },
        intent,
        [questSummaryCard(analysis.draft)]
      );
    }

    if (!analysis.draft.timeline && request.session.planningDeadlinePrompted && isDeadlineAffirmation(message)) {
      return respond(
        "What deadline should I use? You can say something like \"tomorrow\", \"next month\", or \"by August 15\".",
        { ...request.session, planningDraft: analysis.draft, planningDeadlinePrompted: true },
        intent,
        [questSummaryCard(analysis.draft)]
      );
    }

    const action = withE2EScenario(previewProjectCreation(analysis.draft), request.session);
    const preview = await cerbanimo.previewProjectBootstrap(action);
    if (!preview.ok || !preview.data) {
      return respond(
        `I understand the quest, but I cannot prepare the Cerbanimo action preview yet. ${preview.error}`,
        {
          ...request.session,
          planningDraft: analysis.draft,
          planningDeadlinePrompted: undefined
        },
        intent,
        [questSummaryCard(analysis.draft)]
      );
    }

    return respond(
      "I prepared a Cerbanimo action preview. Please review it and confirm before Cerbanimo starts project creation.",
      {
        ...request.session,
        planningDraft: analysis.draft,
        planningDeadlinePrompted: undefined,
        pendingAction: preview.data.preview,
        activeAction: preview.data.activeAction
      },
      intent,
      [questSummaryCard(analysis.draft), actionPreviewCard(preview.data.preview)]
    );
  }

  if (intent.next_action === "submit_task") {
    const action = previewTaskSubmission(message);
    return respond(
      "I can prepare that task submission. Confirm when the task and proof look right.",
      { ...request.session, pendingAction: action },
      intent,
      [actionPreviewCard(action)]
    );
  }

  if (intent.next_action === "queue_automation") {
    if (isAutomationListRequest(message)) {
      const result = await cerbanimo.automationTemplates();
      const items = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
      return respond("Here are the automation workflows Cerbanimo can expose to Kamiya.", request.session, intent, [
        automationTemplatesCard(items, result.mocked)
      ]);
    }

    if (isActionQueueRequest(message)) {
      const result = await cerbanimo.actionQueue();
      const items = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
      const localHistory = (request.session.actionHistory ?? []).map((action) => ({ ...action, status: action.status }));
      return respond("Here is the auditable action queue.", request.session, intent, [
        actionQueueCard([...localHistory, ...items], result.mocked)
      ]);
    }

    if (isValidationReportRequest(message)) {
      const result = await cerbanimo.validationReport(message.replace(/^\/automation\s*/i, ""));
      return respond("I prepared a validation report preview.", request.session, intent, [
        validationReportCard((result.data ?? {}) as Record<string, unknown>, result.mocked)
      ]);
    }

    const action = previewAutomation(intent, message);
    return respond(
      "I can queue this as an auditable automation action. Please confirm before I send it to Cerbanimo.",
      { ...request.session, pendingAction: action },
      intent,
      [actionPreviewCard(action)]
    );
  }

  if (intent.next_action === "search_cerbanimo") {
    const result = await cerbanimo.search(String(intent.entities.query ?? message.replace(/^\/search\s*/i, "")));
    const items = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
    const isCommunitySearch = intent.intent === "community" || message.toLowerCase().startsWith("/community");
    return respond(isCommunitySearch ? "Here are communities matching that direction." : "I found a few Cerbanimo matches.", request.session, intent, [
      searchResultsCard(items, result.mocked)
    ]);
  }

  if (intent.next_action === "show_tasks") {
    const result = await cerbanimo.tasks(String(intent.entities.query ?? message.replace(/^\/task\s*/i, "")));
    const items = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
    return respond("Here is the current task snapshot.", request.session, intent, [taskListCard(items, result.mocked)]);
  }

  if (intent.next_action === "show_stats") {
    const result = await cerbanimo.stats();
    return respond("Here is the current progress snapshot.", request.session, intent, [
      statsCard((result.data ?? {}) as Record<string, unknown>, result.mocked)
    ]);
  }

  if (intent.next_action === "show_profile") {
    const result = await cerbanimo.profile();
    return respond("Here is the profile summary Cerbanimo has for you.", request.session, intent, [
      profileCard((result.data ?? {}) as Record<string, unknown>, result.mocked)
    ]);
  }

  if (intent.next_action === "show_notifications") {
    const result = await cerbanimo.notifications();
    const items = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : [];
    return respond("Here are your recent progress updates.", request.session, intent, [notificationCard(items, result.mocked)]);
  }

  if (intent.next_action === "open_page") {
    const target = String(intent.entities.target ?? message.replace(/^\/(open|project)\s*/i, ""));
    const result = await cerbanimo.renderPage(target);
    return respond("I prepared the Cerbanimo view target.", request.session, intent, [
      navigationCard((result.data ?? {}) as Record<string, unknown>, result.mocked)
    ]);
  }

  if (!request.auth.isLoggedIn) {
    return respond(
      "Hello! I'm Kamiya, your project management and automation assistant.\n\nDream up a quest or endeavor, big or small, and I'll help turn it into reality.\n\nType \"/\" to browse commands or log in to begin.",
      request.session,
      intent
    );
  }

  return respond(
    `I heard you, but I could not map that into an executable Kamiya workflow yet. Routed intent: ${intent.intent}; next action: ${intent.next_action}. Try /plan for project creation, /task for task management, /automation for workflows, or /help to see supported paths.`,
    request.session,
    intent
  );
}

async function persistChatTurn(request: ChatTurnRequest, response: ChatTurnResponse): Promise<ChatTurnResponse> {
  if (request.channel && request.channel !== "web") return response;
  if (!request.auth.isLoggedIn) return response;

  const messages = [...request.history, response.message];
  const chatName = await generateChatName(messages);
  const session = {
    ...response.session,
    chatId: request.session.chatId,
    chatName
  };

  const saved = await new CerbanimoClient(request.auth).saveChat({
    chatId: session.chatId,
    name: chatName,
    messages,
    session
  });
  const savedChat = saved.ok ? saved.data?.chat : undefined;

  return {
    ...response,
    session: {
      ...session,
      chatId: typeof savedChat?.id === "number" ? savedChat.id : session.chatId,
      chatName: savedChat?.name ?? session.chatName
    }
  };
}

export async function handleChannelTurn(channelRequest: {
  channel: ChatTurnRequest["channel"];
  text: string;
  externalUserId?: string;
  workspaceId?: string;
  displayName?: string;
}): Promise<ChatTurnResponse> {
  return handleChatTurn({
    message: channelRequest.text.trim() || "/help",
    history: [],
    session: {},
    channel: channelRequest.channel,
    auth: {
      isLoggedIn: Boolean(channelRequest.externalUserId),
      displayName: channelRequest.displayName,
      externalUserId: channelRequest.externalUserId,
      workspaceId: channelRequest.workspaceId,
      channel: channelRequest.channel,
      permissions: ["automation:create"]
    }
  });
}

export async function hydrateActionResponse(
  auth: ChatTurnRequest["auth"],
  session: ChatTurnRequest["session"],
  actionId: string
): Promise<ChatTurnResponse> {
  const detail = await new CerbanimoClient(auth).getActionDetail(actionId);
  if (!detail.ok || !detail.data) {
    return respond(
      `I could not refresh the Cerbanimo action yet. ${detail.error ?? "The action remains recoverable; try again in a moment."}`,
      {
        ...session,
        activeAction: session.activeAction
          ? { ...session.activeAction, lastHydratedAt: new Date().toISOString(), requestId: detail.requestId ?? session.activeAction.requestId }
          : undefined
      }
    );
  }

  const activeAction = activeStateFromDetail(detail.data, detail.requestId);
  const terminal = isTerminalDetail(detail.data);
  return respond(
    terminal
      ? terminalMessage(detail.data)
      : "Cerbanimo is still preparing your quest. The workflow below is the durable source of truth.",
    {
      ...session,
      activeAction,
      pendingAction: terminal ? undefined : session.pendingAction,
      planningDraft: terminal ? undefined : session.planningDraft
    },
    undefined,
    cardsForActionDetail(detail.data, detail.requestId)
  );
}

async function retryDurableAction(request: ChatTurnRequest, requestedActionId?: string): Promise<ChatTurnResponse> {
  const actionId = requestedActionId ?? request.session.activeAction?.actionUuid ?? request.session.activeAction?.actionId;
  if (!actionId) return respond("I do not have a Cerbanimo action to retry yet.", request.session);

  const retry = await new CerbanimoClient(request.auth).retryAction(actionId);
  if (!retry.ok) {
    return respond(`Cerbanimo did not accept the retry: ${retry.error}`, {
      ...request.session,
      activeAction: request.session.activeAction
        ? { ...request.session.activeAction, requestId: retry.requestId ?? request.session.activeAction.requestId }
        : undefined
    });
  }

  return hydrateActionResponse(request.auth, {
    ...request.session,
    activeAction: request.session.activeAction
      ? { ...request.session.activeAction, status: "queued", requestId: retry.requestId ?? request.session.activeAction.requestId }
      : request.session.activeAction
  }, actionId);
}

async function cancelDurableAction(request: ChatTurnRequest, requestedActionId?: string): Promise<ChatTurnResponse> {
  const actionId = requestedActionId ?? request.session.activeAction?.actionUuid ?? request.session.activeAction?.actionId;
  if (!actionId) {
    return respond("All set. I cancelled that pending action.", {
      ...request.session,
      pendingAction: undefined,
      planningDeadlinePrompted: undefined
    });
  }

  const cancelled = await new CerbanimoClient(request.auth).cancelAction(actionId);
  if (!cancelled.ok) {
    return respond(`Cerbanimo could not cancel that action: ${cancelled.error}`, {
      ...request.session,
      activeAction: request.session.activeAction
        ? { ...request.session.activeAction, requestId: cancelled.requestId ?? request.session.activeAction.requestId }
        : undefined
    });
  }

  return hydrateActionResponse(request.auth, {
    ...request.session,
    pendingAction: undefined,
    activeAction: request.session.activeAction
      ? { ...request.session.activeAction, status: "cancelled", requestId: cancelled.requestId ?? request.session.activeAction.requestId }
      : undefined
  }, actionId);
}

async function executePendingAction(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const action = request.session.pendingAction;
  if (!action) return respond("There is no pending action to execute.", request.session);

  if (action.kind === "create_project" && request.session.activeAction && !["previewed"].includes(request.session.activeAction.status)) {
    return hydrateActionResponse(request.auth, request.session, request.session.activeAction.actionUuid ?? request.session.activeAction.actionId);
  }

  const result = await new CerbanimoClient(request.auth).executeAction(action);
  if (!result.ok) {
    return respond(`Cerbanimo rejected that action: ${result.error}`, {
      ...request.session,
      activeAction: request.session.activeAction
    });
  }

  if (action.kind === "create_project") {
    const detail = (result.data as { detail?: ProjectBootstrapActionDetail } | undefined)?.detail;
    if (!detail) {
      return respond("Confirmed. Cerbanimo accepted the quest, but Kamiya could not hydrate the workflow detail yet. I will keep this action recoverable.", {
        ...request.session,
        pendingAction: undefined,
        activeAction: request.session.activeAction ? { ...request.session.activeAction, status: "confirmed" } : undefined,
        planningDeadlinePrompted: undefined
      });
    }

    const activeAction = activeStateFromDetail(detail, result.requestId);
    const cards = cardsForActionDetail(detail, result.requestId);
    return respond(
      isTerminalDetail(detail)
        ? terminalMessage(detail)
        : "Confirmed. Cerbanimo is preparing your quest now. I will show the durable workflow progress here as it runs.",
      {
        ...request.session,
        pendingAction: undefined,
        planningDeadlinePrompted: undefined,
        planningDraft: undefined,
        activeAction,
        lastProjectAction: action
      },
      undefined,
      cards
    );
  }

  const taskWaitTimedOut = Boolean((result.data as { taskWaitTimedOut?: unknown } | undefined)?.taskWaitTimedOut);
  const record = {
    id: crypto.randomUUID(),
    previewId: action.id,
    kind: action.kind,
    status: taskWaitTimedOut ? ("failed" as const) : action.kind === "run_automation" ? ("queued" as const) : ("completed" as const),
    title: action.title,
    summary: action.summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mocked: result.mocked,
    ...((result.data ?? {}) as Record<string, unknown>)
  };
  const actionHistory = [record, ...(request.session.actionHistory ?? [])].slice(0, 8);

  return respond(
    result.mocked
      ? "Confirmed. I simulated the Cerbanimo call because live API credentials are not configured yet."
      : "Confirmed. I sent the action to Cerbanimo and logged the result.",
    {
      ...request.session,
      pendingAction: undefined,
      planningDeadlinePrompted: undefined,
      planningDraft: request.session.planningDraft,
      lastProjectAction: request.session.lastProjectAction,
      actionHistory
    },
    undefined,
    [actionQueueCard(actionHistory, result.mocked)]
  );
}

function respond(
  content: string,
  session: ChatTurnResponse["session"],
  intent?: ChatMessage["intent"],
  cards?: ChatMessage["cards"]
): ChatTurnResponse {
  return {
    session,
    message: {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      intent,
      cards
    }
  };
}

function isConfirmation(message: string): boolean {
  return /^(confirm|yes|y|approve|execute|do it)$/i.test(message.trim());
}

function isCancel(message: string): boolean {
  return /^(cancel|stop|nevermind|never mind)$/i.test(message.trim());
}

function isDeadlineAffirmation(message: string): boolean {
  return /^(yes|y|sure|please|add one|set one|deadline|with deadline)$/i.test(message.trim());
}

function isAutomationListRequest(message: string): boolean {
  return /^\/automation\s*(list|templates|help)?\s*$/i.test(message.trim());
}

function isActionQueueRequest(message: string): boolean {
  return /\b(queue|history|status|actions?)\b/i.test(message);
}

function isValidationReportRequest(message: string): boolean {
  return /\b(validation report|report|validate preview)\b/i.test(message);
}

function isProjectPlanningTurn(message: string, intent: ChatMessage["intent"], planningDraft?: ChatTurnRequest["session"]["planningDraft"]): boolean {
  if (planningDraft && Object.keys(planningDraft).length > 0) return true;
  if (!intent) return false;
  if (intent.intent === "planning") return true;
  if (intent.next_action !== "ask_missing_inputs") return false;
  if (message.trim().toLowerCase().startsWith("/create")) return true;
  return intent.intent === "administration" && /\b(project|quest|plan|create|start)\b/i.test(message);
}

function parseDurableActionCommand(message: string): { verb: "retry" | "cancel"; actionId?: string } | undefined {
  const match = message.match(/^(retry|cancel)\s+action(?:\s+(.+))?$/i);
  if (!match?.[1]) return undefined;
  return {
    verb: match[1].toLowerCase() as "retry" | "cancel",
    actionId: match[2]?.trim()
  };
}

function activeStateFromDetail(detail: ProjectBootstrapActionDetail, requestId?: string): ActiveCerbanimoActionState {
  const status = normalizedConversationStatus(detail);
  const currentStage = detail.steps.find((step) => step.status === "running")?.step_name
    ?? detail.steps.find((step) => step.status === "failed")?.step_name
    ?? nextIncompleteStage(detail);

  return {
    actionId: String(detail.action.id),
    actionUuid: detail.action.action_uuid ?? undefined,
    workflowRunId: detail.workflow?.id ? String(detail.workflow.id) : undefined,
    functionName: "projects.bootstrap",
    status,
    currentStage,
    projectId: detail.project?.id ?? detail.workflow?.related_project_id ?? detail.action.related_project_id ?? undefined,
    startedAt: detail.action.created_at ?? detail.workflow?.created_at ?? undefined,
    lastHydratedAt: new Date().toISOString(),
    requestId
  };
}

function normalizedConversationStatus(detail: ProjectBootstrapActionDetail): ActiveCerbanimoActionState["status"] {
  const actionStatus = String(detail.action.status ?? "");
  const workflowStatus = String(detail.workflow?.status ?? "");
  if (workflowStatus === "completed" && actionStatus === "executed") return "completed";
  if (workflowStatus === "completed") return "completed";
  if (workflowStatus === "cancelled" || actionStatus === "cancelled") return "cancelled";
  if (workflowStatus === "blocked") return "blocked";
  if (workflowStatus === "failed" || actionStatus === "failed") return "failed";
  if (workflowStatus === "retry_wait") return "retry_wait";
  if (workflowStatus === "running") return "running";
  if (workflowStatus === "queued") return "queued";
  if (actionStatus === "confirmed") return "queued";
  if (actionStatus === "previewed") return "previewed";
  if (actionStatus === "executed") return "executed";
  return "confirmed";
}

function cardsForActionDetail(detail: ProjectBootstrapActionDetail, requestId?: string): ChatMessage["cards"] {
  const status = normalizedConversationStatus(detail);
  if (status === "completed" || status === "executed") return projectResultCards(detail);
  if (status === "blocked" || status === "failed" || status === "cancelled") return [workflowFailureCard(detail, requestId)];
  return [workflowProgressCard(detail, requestId)];
}

function isTerminalDetail(detail: ProjectBootstrapActionDetail): boolean {
  const status = normalizedConversationStatus(detail);
  return ["completed", "executed", "blocked", "failed", "cancelled"].includes(status) || detail.terminal;
}

function terminalMessage(detail: ProjectBootstrapActionDetail): string {
  const status = normalizedConversationStatus(detail);
  if (status === "completed" || status === "executed") {
    return "Your quest is live. Cerbanimo created the project, mapped its dependencies, and activated the first tasks that can begin now.";
  }
  if (status === "cancelled") return "Quest creation was cancelled before the project was committed.";
  if (status === "blocked") return "Cerbanimo blocked this quest creation before committing a project. Review the failure details and retry only if the inputs are corrected.";
  return "Cerbanimo could not finish preparing this quest. The failure card includes the stage, code, retryability, and next action.";
}

function nextIncompleteStage(detail: ProjectBootstrapActionDetail): string | undefined {
  const completed = new Set(detail.steps.filter((step) => step.status === "completed" || step.status === "skipped").map((step) => step.step_name));
  return ["validateInput", "generateProjectPlan", "generateTaskGraph", "validateTaskGraph", "persistProjectGraph", "activateRootTasks", "finalizeAction"]
    .find((stage) => !completed.has(stage));
}

function withE2EScenario(action: ReturnType<typeof previewProjectCreation>, session: ChatTurnRequest["session"]): ReturnType<typeof previewProjectCreation> {
  if (process.env.KAMIYA_REAL_STACK_E2E !== "1" || !session.e2eScenario) return action;
  return {
    ...action,
    payload: {
      ...action.payload,
      _e2eScenario: session.e2eScenario,
      _e2eRunId: session.e2eRunId,
      _e2eControlDir: session.e2eControlDir
    }
  };
}
