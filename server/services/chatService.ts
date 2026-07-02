import type { ChatMessage, ChatTurnRequest, ChatTurnResponse } from "../../shared/types";
import { matchSlashCommand } from "../../shared/commands";
import {
  actionPreviewCard,
  actionQueueCard,
  automationTemplatesCard,
  integrationCard,
  helpCard,
  navigationCard,
  notificationCard,
  profileCard,
  questSummaryCard,
  searchResultsCard,
  statsCard,
  taskListCard,
  validationReportCard,
  modeCard
} from "./cardFactory";
import { CerbanimoClient } from "./cerbanimoClient";
import { previewAutomation, previewProjectCreation, previewTaskSubmission } from "./actionPlanner";
import { routeIntent } from "./intentRouter";
import { analyzePlanning } from "./planningService";
import { parseModeCommand, shouldShowModes } from "./modeService";

export async function handleChatTurn(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const message = request.message.trim();

  if (request.session.pendingAction && isConfirmation(message)) {
    return executePendingAction(request);
  }

  if (request.session.pendingAction && isCancel(message)) {
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

    const action = previewProjectCreation(analysis.draft);
    return respond(
      "I have enough to create this quest. Please confirm before I write it to Cerbanimo.",
      { ...request.session, planningDraft: analysis.draft, planningDeadlinePrompted: undefined, pendingAction: action },
      intent,
      [questSummaryCard(analysis.draft), actionPreviewCard(action)]
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

async function executePendingAction(request: ChatTurnRequest): Promise<ChatTurnResponse> {
  const action = request.session.pendingAction;
  if (!action) return respond("There is no pending action to execute.", request.session);

  const result = await new CerbanimoClient(request.auth).executeAction(action);
  if (!result.ok) {
    return respond(`Cerbanimo rejected that action: ${result.error}`, {
      ...request.session,
      pendingAction: undefined
    });
  }

  const record = {
    id: crypto.randomUUID(),
    previewId: action.id,
    kind: action.kind,
    status: action.kind === "run_automation" ? ("queued" as const) : ("completed" as const),
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
      planningDraft: action.kind === "create_project" ? undefined : request.session.planningDraft,
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
