import type {
  ActiveCerbanimoActionState,
  ChatMessage,
  ChatTurnRequest,
  ChatTurnResponse,
  ProjectBootstrapActionDetail,
  TaskAutomationContext
} from "../../shared/types";
import { matchSlashCommand } from "../../shared/commands";
import {
  actionPreviewCard,
  actionQueueCard,
  automationRunResultCard,
  automationTemplatesCard,
  activeTaskCard,
  evidenceBundleCard,
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
  taskAutomationPreparationCard,
  reviewAssignmentCard,
  reviewAssignmentsCard,
  reviewStatusCard,
  workflowFailureCard,
  workflowProgressCard
} from "./cardFactory";
import {
  characterCallingCard,
  chronicleCard,
  gameMasterActionPreview,
  inviteCreatedCard,
  invitePreviewCard,
  narrativeSettingsCard,
  partyAssemblyCard,
  questOpeningSceneCard,
  questScrollCard
} from "./gameMasterCardFactory";
import { CerbanimoClient } from "./cerbanimoClient";
import { previewAutomation, previewProjectCreation } from "./actionPlanner";
import { routeIntent } from "./intentRouter";
import { analyzePlanning } from "./planningService";
import { parseModeCommand, shouldShowModes } from "./modeService";
import { generateChatName } from "./chatTitleService";
import { applyPreferenceCommand, gameMasterPreferenceCopy, oneTurnPlainCopy, parseGameMasterModeCommand } from "./gameMasterModeService";
import { parsePartyCommand } from "./partyAssemblyService";
import { projectQuestNarration } from "./narrativeProjectionService";
import type { GameMasterModeCommand } from "./gameMasterModeService";
import type { PartyCommand } from "./partyAssemblyService";

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

  const gameMasterModeCommand = parseGameMasterModeCommand(message);
  if (gameMasterModeCommand) {
    if (gameMasterModeCommand.kind === "plain_override") {
      const questCommand = parseQuestCommand(gameMasterModeCommand.strippedMessage);
      if (questCommand?.kind === "show_quest") {
        return showQuestContext(request, questCommand.projectId, true);
      }
      return respond(oneTurnPlainCopy(gameMasterModeCommand.strippedMessage), request.session);
    }
    return updateGameMasterPreferences(request, gameMasterModeCommand);
  }

  const questCommand = parseQuestCommand(message);
  if (questCommand?.kind === "show_quest") {
    return showQuestContext(request, questCommand.projectId);
  }
  if (questCommand?.kind === "launch") {
    return previewQuestLaunch(request, questCommand.projectId);
  }
  if (questCommand?.kind === "chronicle") {
    return showQuestChronicle(request, questCommand.projectId);
  }

  const partyCommand = parsePartyCommand(message);
  if (partyCommand) {
    return handlePartyCommand(request, partyCommand);
  }

  const taskAutomationCommand = parseTaskAutomationCommand(message);
  if (taskAutomationCommand?.kind === "prepare") {
    return prepareTaskAutomation(request, taskAutomationCommand.taskId, taskAutomationCommand.inputValues);
  }

  if (taskAutomationCommand?.kind === "quality_checks") {
    return reviewQualityChecks(request, taskAutomationCommand.taskId);
  }

  const evidenceCommand = parseTaskEvidenceCommand(message);
  if (evidenceCommand) {
    return handleTaskEvidenceCommand(request, evidenceCommand);
  }

  const reviewCommand = parseReviewCommand(message);
  if (reviewCommand) {
    return handleReviewCommand(request, reviewCommand);
  }

  if (/^view required inputs\b/i.test(message) && request.session.activeAction?.actionId) {
    const taskId = message.replace(/^view required inputs\b/i, "").trim();
    if (taskId) return prepareTaskAutomation(request, taskId, {});
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
    const taskId = taskIdFromMessageOrIntent(message, intent);
    if (!taskId) {
      return respond(
        "I can help submit task evidence, but I need the Cerbanimo task id first.",
        request.session,
        intent
      );
    }
    return startEvidenceSubmission(request, taskId, intent);
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

async function updateGameMasterPreferences(
  request: ChatTurnRequest,
  command: Exclude<GameMasterModeCommand, { kind: "plain_override" }>
): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const current = await cerbanimo.getNarrativePreferences();
  const input = applyPreferenceCommand(command, current.data?.preferences);
  const result = await cerbanimo.updateNarrativePreferences(input);
  if (!result.ok || !result.data) {
    return respond(`I could not update Game Master preferences in Cerbanimo: ${result.error}`, request.session);
  }
  const preferences = result.data.preferences;
  return respond(
    gameMasterPreferenceCopy(preferences),
    {
      ...request.session,
      presentationMode: preferences.presentationMode,
      narrativeIntensity: preferences.narrativeIntensity,
      statDisplayMode: preferences.statDisplayMode,
      preferredGenre: preferences.preferredGenres[0],
      avoidThemes: preferences.avoidThemes
    },
    undefined,
    [narrativeSettingsCard(preferences)]
  );
}

type QuestCommand =
  | { kind: "show_quest"; projectId: string }
  | { kind: "launch"; projectId: string }
  | { kind: "chronicle"; projectId: string };

function parseQuestCommand(message: string): QuestCommand | undefined {
  const trimmed = message.trim();
  const show = trimmed.match(/^\/quest\s+(\S+)$/i)
    ?? trimmed.match(/^\/project\s+(\S+)\s+quest$/i)
    ?? trimmed.match(/^show quest\s+(\S+)$/i);
  if (show?.[1]) return { kind: "show_quest", projectId: show[1] };

  const launch = trimmed.match(/^\/launch\s+quest\s+(\S+)$/i)
    ?? trimmed.match(/^launch quest\s+(\S+)$/i);
  if (launch?.[1]) return { kind: "launch", projectId: launch[1] };

  const chronicle = trimmed.match(/^\/chronicle\s+(\S+)$/i)
    ?? trimmed.match(/^show chronicle\s+(\S+)$/i);
  if (chronicle?.[1]) return { kind: "chronicle", projectId: chronicle[1] };

  return undefined;
}

async function showQuestContext(request: ChatTurnRequest, projectId: string, plainOverride = false): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const [contextResult, preferencesResult] = await Promise.all([
    cerbanimo.getQuestContext(projectId),
    cerbanimo.getNarrativePreferences()
  ]);
  if (!contextResult.ok || !contextResult.data) {
    return respond(`I could not load that quest from Cerbanimo: ${contextResult.error}`, request.session);
  }
  const preferences = preferencesResult.data?.preferences;
  const content = projectQuestNarration(contextResult.data, preferences, plainOverride);
  return respond(
    content,
    {
      ...request.session,
      currentQuestProjectId: contextResult.data.project?.id ?? projectId,
      presentationMode: plainOverride ? request.session.presentationMode : preferences?.presentationMode ?? request.session.presentationMode,
      narrativeIntensity: preferences?.narrativeIntensity ?? request.session.narrativeIntensity,
      statDisplayMode: preferences?.statDisplayMode ?? request.session.statDisplayMode
    },
    undefined,
    [
      questScrollCard(contextResult.data),
      partyAssemblyCard({
        project: contextResult.data.project,
        settings: contextResult.data.party?.settings,
        members: contextResult.data.party?.members,
        shortage: contextResult.data.party?.shortage,
        allowedActions: contextResult.data.allowedActions
      }),
      ...(contextResult.data.chronicle?.length ? [chronicleCard({ project: contextResult.data.project, events: contextResult.data.chronicle, allowedActions: contextResult.data.allowedActions })] : [])
    ]
  );
}

async function previewQuestLaunch(request: ChatTurnRequest, projectId: string): Promise<ChatTurnResponse> {
  const result = await new CerbanimoClient(request.auth).launchQuestPreview(projectId);
  if (!result.ok || !result.data) {
    return respond(`Cerbanimo could not prepare the quest launch preview: ${result.error}`, request.session);
  }
  const action = result.data.action
    ? gameMasterActionPreview(result.data.action, "Launch quest opening", result.data.openingScene ?? "Confirm the Game Master quest launch.")
    : undefined;
  return respond(
    result.data.canLaunch
      ? "I prepared the quest opening scene. Confirm before Cerbanimo records the launch event."
      : "Cerbanimo says this quest is not ready to launch yet.",
    {
      ...request.session,
      pendingAction: action,
      currentQuestProjectId: projectId
    },
    undefined,
    [
      questOpeningSceneCard(result.data),
      ...(action ? [actionPreviewCard(action)] : [])
    ]
  );
}

async function showQuestChronicle(request: ChatTurnRequest, projectId: string): Promise<ChatTurnResponse> {
  const result = await new CerbanimoClient(request.auth).getChronicle(projectId);
  if (!result.ok || !result.data) {
    return respond(`I could not load the quest chronicle from Cerbanimo: ${result.error}`, request.session);
  }
  return respond("Here is the chronicle Cerbanimo returned for this quest.", { ...request.session, currentQuestProjectId: projectId }, undefined, [chronicleCard(result.data)]);
}

async function handlePartyCommand(request: ChatTurnRequest, command: PartyCommand): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  if (command.kind === "show_party") {
    const result = await cerbanimo.getParty(command.projectId);
    if (!result.ok || !result.data) return respond(`I could not load that project party: ${result.error}`, request.session);
    return respond("Here is the project party Cerbanimo returned.", { ...request.session, currentQuestProjectId: command.projectId }, undefined, [partyAssemblyCard(result.data)]);
  }
  if (command.kind === "create_invite") {
    const result = await cerbanimo.createProjectInvite(command.projectId);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not create a project invite: ${result.error}`, request.session);
    return respond("Cerbanimo created a party invite. The raw token is shown once in the card metadata.", { ...request.session, currentQuestProjectId: command.projectId }, undefined, [inviteCreatedCard(result.data)]);
  }
  if (command.kind === "preview_invite") {
    const result = await cerbanimo.previewProjectInvite(command.token);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not preview that invite: ${result.error}`, request.session);
    return respond("Cerbanimo returned the invite preview.", request.session, undefined, [invitePreviewCard(result.data)]);
  }
  if (command.kind === "redeem_invite") {
    const result = await cerbanimo.redeemProjectInvite(command.token);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not redeem that invite: ${result.error}`, request.session);
    const projectId = result.data.projectId ? String(result.data.projectId) : request.session.currentQuestProjectId ? String(request.session.currentQuestProjectId) : "";
    const calling = projectId ? await cerbanimo.getCalling(projectId) : undefined;
    return respond(
      "You joined the quest party. You can update your calling when you are ready.",
      { ...request.session, currentQuestProjectId: result.data.projectId ?? request.session.currentQuestProjectId },
      undefined,
      calling?.data ? [characterCallingCard(calling.data)] : []
    );
  }
  if (command.kind === "show_calling") {
    const result = await cerbanimo.getCalling(command.projectId);
    if (!result.ok || !result.data) return respond(`I could not load your calling: ${result.error}`, request.session);
    return respond("Here is your current character calling for this quest.", { ...request.session, currentQuestProjectId: command.projectId }, undefined, [characterCallingCard(result.data)]);
  }
  const updated = await cerbanimo.updateCalling(command.projectId, command.input);
  if (!updated.ok || !updated.data) return respond(`Cerbanimo could not update your calling: ${updated.error}`, request.session);
  return respond("Calling updated. Cerbanimo remains the source of truth for party membership.", { ...request.session, currentQuestProjectId: command.projectId }, undefined, [characterCallingCard(updated.data)]);
}

async function prepareTaskAutomation(
  request: ChatTurnRequest,
  taskId: string,
  inputValues: Record<string, unknown>
): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const hasInputs = Object.keys(inputValues).length > 0;
  const result = hasInputs
    ? await cerbanimo.createTaskAutomationPreparation(taskId, { inputValues })
    : await cerbanimo.getTaskAutomation(taskId);

  if (!result.ok || !result.data) {
    return respond(`I could not load task automation state from Cerbanimo: ${result.error}`, request.session);
  }

  const context = result.data;
  const message = context.preparation
    ? `Cerbanimo saved the task automation preparation as ${context.preparation.status}.`
    : context.inputSchema.length
      ? "Cerbanimo returned the required task automation inputs. Send them as key=value pairs after the prepare command when you are ready."
      : "Cerbanimo returned the task automation policy for this task.";

  return respond(message, request.session, undefined, [taskAutomationPreparationCard(context)]);
}

async function reviewQualityChecks(request: ChatTurnRequest, taskId: string): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const repository = process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REPOSITORY;
  const ref = process.env.KAMIYA_DEFAULT_QUALITY_CHECK_REF ?? "main";

  if (!repository) {
    const context = await cerbanimo.getTaskAutomation(taskId);
    if (!context.ok || !context.data) {
      return respond(`I could not load quality-check requirements from Cerbanimo: ${context.error}`, request.session);
    }
    return respond(
      "Cerbanimo needs a repository before I can prepare quality checks. Send `prepare task automation " + taskId + " repository=owner/name ref=main checkProfile=node_standard approval=yes`.",
      request.session,
      undefined,
      [taskAutomationPreparationCard(context.data)]
    );
  }

  const prepared = await cerbanimo.createTaskAutomationPreparation(taskId, {
    capabilityName: "github.run_quality_checks",
    inputValues: {
      repository,
      ref,
      checkProfile: "node_standard",
      approval: true
    }
  });
  if (!prepared.ok || !prepared.data) {
    return respond(`Cerbanimo could not save the quality-check preparation: ${prepared.error}`, request.session);
  }

  if (!prepared.data.preparation?.id || !prepared.data.capability.executionAvailable) {
    return respond(
      `Cerbanimo saved the preparation, but it is not executable yet. Reasons: ${prepared.data.capability.reasons.join(", ") || "unknown"}.`,
      request.session,
      undefined,
      [taskAutomationPreparationCard(prepared.data)]
    );
  }

  const preview = await cerbanimo.previewTaskAutomationPreparation(taskId, prepared.data.preparation.id);
  if (!preview.ok || !preview.data?.action) {
    return respond(`Cerbanimo could not create a quality-check action preview: ${preview.error}`, request.session, undefined, [taskAutomationPreparationCard(prepared.data)]);
  }

  const action = automationPreviewFromTaskContext(preview.data);
  return respond(
    "I prepared a Cerbanimo quality-check action preview. Please confirm before Cerbanimo runs repository checks.",
    { ...request.session, pendingAction: action },
    undefined,
    [taskAutomationPreparationCard(preview.data), actionPreviewCard(action)]
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
    messages: redactSensitiveMessages(messages),
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

function redactSensitiveMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    cards: message.cards?.map((card) => ({
      ...card,
      metadata: card.metadata
        ? Object.fromEntries(
            Object.entries(card.metadata).map(([key, value]) => [
              key,
              ["token", "inviteUrl"].includes(key) ? "[redacted after one-time display]" : value
            ])
          )
        : undefined
    }))
  }));
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
  const automationRun = (result.data as { automationRun?: unknown } | undefined)?.automationRun;
  const record = {
    id: crypto.randomUUID(),
    previewId: action.id,
    kind: action.kind,
    status: taskWaitTimedOut
      ? ("failed" as const)
      : action.kind === "run_automation" || action.kind === "submit_task"
        ? automationHistoryStatus(automationRun)
        : ("completed" as const),
    title: action.title,
    summary: action.summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mocked: result.mocked,
    ...((result.data ?? {}) as Record<string, unknown>)
  };
  const actionHistory = [record, ...(request.session.actionHistory ?? [])].slice(0, 8);

  return respond(
    action.kind === "run_automation" && automationRun
      ? automationConfirmationMessage(automationRun)
      : action.kind === "submit_task" && automationRun
        ? evidenceConfirmationMessage(automationRun)
      : result.mocked
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
    [
      ...((action.kind === "run_automation" || action.kind === "submit_task") && isAutomationRunRecord(automationRun) ? [automationRunResultCard(automationRun)] : []),
      actionQueueCard(actionHistory, result.mocked)
    ]
  );
}

type TaskEvidenceCommand =
  | { kind: "requirements" | "start" | "preview"; taskId: string }
  | { kind: "add_text"; taskId: string; text: string }
  | { kind: "fetch_url"; taskId: string; url: string }
  | { kind: "supersede"; taskId: string; bundleId: string }
  | { kind: "cancel"; taskId: string; bundleId: string };

type ReviewCommand =
  | { kind: "queue" }
  | { kind: "status"; taskId: string }
  | { kind: "open"; assignmentId: string }
  | { kind: "accept" | "decline"; assignmentId: string; reason?: string }
  | { kind: "recuse"; assignmentId: string; reason: string }
  | { kind: "validation_decision"; reviewId: string; decision: string; reason?: string }
  | { kind: "peer_decision" | "pm_decision"; roundId: string; assignmentId?: string; decision: string; reason?: string };

async function handleTaskEvidenceCommand(request: ChatTurnRequest, command: TaskEvidenceCommand): Promise<ChatTurnResponse> {
  if (command.kind === "requirements") return showEvidenceRequirements(request, command.taskId);
  if (command.kind === "start") return startEvidenceSubmission(request, command.taskId);
  if (command.kind === "add_text") return addTextEvidence(request, command.taskId, command.text);
  if (command.kind === "fetch_url") return addUrlEvidence(request, command.taskId, command.url);
  if (command.kind === "supersede") return supersedeEvidenceBundle(request, command.taskId, command.bundleId);
  if (command.kind === "cancel") return cancelEvidenceBundle(request, command.taskId, command.bundleId);
  return previewEvidenceSubmission(request, command.taskId);
}

async function handleReviewCommand(request: ChatTurnRequest, command: ReviewCommand): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  if (command.kind === "queue") {
    const result = await cerbanimo.listReviewAssignments();
    if (!result.ok || !result.data) return respond(`I could not load your review queue from Cerbanimo: ${result.error}`, request.session);
    return respond("Here is your Cerbanimo review queue.", request.session, undefined, [reviewAssignmentsCard(result.data)]);
  }
  if (command.kind === "status") {
    const result = await cerbanimo.taskReviewStatus(command.taskId);
    if (!result.ok || !result.data) return respond(`I could not load that task review status from Cerbanimo: ${result.error}`, request.session);
    return respond(result.data.copy ?? "Cerbanimo returned the task review status.", request.session, undefined, [reviewStatusCard(result.data)]);
  }
  if (command.kind === "open") {
    const result = await cerbanimo.getReviewAssignment(command.assignmentId);
    if (!result.ok || !result.data) return respond(`I could not open that review assignment: ${result.error}`, request.session);
    return respond("Cerbanimo returned the review assignment. Raw evidence remains hidden until the assignment is accepted.", request.session, undefined, [reviewAssignmentCard(result.data)]);
  }
  if (command.kind === "accept") {
    const result = await cerbanimo.acceptReviewAssignment(command.assignmentId);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not accept that review assignment: ${result.error}`, request.session);
    return respond("Review assignment accepted. Cerbanimo will show only the frozen evidence scoped to this review.", request.session, undefined, [reviewAssignmentCard(result.data)]);
  }
  if (command.kind === "decline") {
    const result = await cerbanimo.declineReviewAssignment(command.assignmentId, command.reason);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not decline that review assignment: ${result.error}`, request.session);
    return respond("Review assignment declined.", request.session, undefined, [reviewAssignmentCard(result.data)]);
  }
  if (command.kind === "recuse") {
    const result = await cerbanimo.recuseReviewAssignment(command.assignmentId, command.reason);
    if (!result.ok || !result.data) return respond(`Cerbanimo could not record the recusal: ${result.error}`, request.session);
    return respond("Recusal recorded. Frozen evidence access for that assignment is closed.", request.session, undefined, [reviewAssignmentCard(result.data)]);
  }
  if (command.kind === "validation_decision") {
    const result = await cerbanimo.decideValidationReview(command.reviewId, { decision: command.decision, reason: command.reason });
    if (!result.ok || !result.data) return respond(`Cerbanimo could not record that validation decision: ${result.error}`, request.session);
    return respond("Manual validation decision recorded. The original evidence remains immutable.", request.session, undefined, [reviewStatusCard(result.data)]);
  }
  if (command.kind === "peer_decision") {
    const result = await cerbanimo.decidePeerReview(command.roundId, { assignmentId: command.assignmentId, decision: command.decision, reason: command.reason });
    if (!result.ok || !result.data) return respond(`Cerbanimo could not record that peer decision: ${result.error}`, request.session);
    return respond(peerDecisionCopy(command.decision), request.session, undefined, [reviewStatusCard(result.data)]);
  }
  if (command.kind === "pm_decision") {
    const result = await cerbanimo.decidePmReview(command.roundId, { assignmentId: command.assignmentId, decision: command.decision, reason: command.reason });
    if (!result.ok || !result.data) return respond(`Cerbanimo could not record that PM decision: ${result.error}`, request.session);
    return respond(pmDecisionCopy(command.decision), request.session, undefined, [reviewStatusCard(result.data)]);
  }
  return respond("I could not recognize that review command.", request.session);
}

async function showEvidenceRequirements(
  request: ChatTurnRequest,
  taskId: string,
  intent?: ChatMessage["intent"]
): Promise<ChatTurnResponse> {
  const result = await new CerbanimoClient(request.auth).taskEvidence(taskId);
  if (!result.ok || !result.data) {
    return respond(`I could not load task evidence requirements from Cerbanimo: ${result.error}`, request.session, intent);
  }
  return respond(
    "Cerbanimo returned the evidence requirements for that task.",
    request.session,
    intent,
    [evidenceBundleCard(result.data, "Evidence requirements")]
  );
}

async function startEvidenceSubmission(
  request: ChatTurnRequest,
  taskId: string,
  intent?: ChatMessage["intent"]
): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const created = await cerbanimo.createEvidenceBundle(taskId);
  if (!created.ok || !created.data) {
    return respond(`I could not start an evidence draft in Cerbanimo: ${created.error}`, request.session, intent);
  }
  const requirements = await cerbanimo.taskEvidence(taskId);
  const context = {
    ...(requirements.data ?? {}),
    ...(created.data ?? {}),
    requirements: requirements.data?.requirements ?? created.data.requirements ?? []
  };
  return respond(
    "I started a Cerbanimo evidence draft for that task.",
    request.session,
    intent,
    [evidenceBundleCard(context, "Task evidence draft")]
  );
}

async function addTextEvidence(request: ChatTurnRequest, taskId: string, text: string): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const created = await cerbanimo.createEvidenceBundle(taskId, {
    reflection: text.slice(0, 2000)
  });
  if (!created.ok || !created.data?.bundle) {
    return respond(`I could not prepare the evidence draft in Cerbanimo: ${created.error}`, request.session);
  }
  const added = await cerbanimo.addEvidenceItem(taskId, created.data.bundle.bundle_uuid ?? created.data.bundle.id, {
    evidenceType: "text",
    title: "Submitted text evidence",
    textContent: text
  });
  if (!added.ok || !added.data) {
    return respond(`Cerbanimo could not save that evidence: ${evidenceErrorCopy(added)}`, request.session, undefined, [evidenceBundleCard(created.data, "Task evidence draft")]);
  }
  return respond(
    "I saved that evidence in Cerbanimo. Preview the submission when the bundle looks complete.",
    request.session,
    undefined,
    [evidenceBundleCard(added.data, "Task evidence draft")]
  );
}

async function addUrlEvidence(request: ChatTurnRequest, taskId: string, url: string): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const created = await cerbanimo.createEvidenceBundle(taskId);
  if (!created.ok || !created.data?.bundle) {
    return respond(`I could not prepare the evidence draft in Cerbanimo: ${created.error}`, request.session);
  }
  const added = await cerbanimo.fetchEvidenceUrl(taskId, created.data.bundle.bundle_uuid ?? created.data.bundle.id, { url });
  if (!added.ok || !added.data) {
    return respond(`Cerbanimo could not snapshot that URL as evidence: ${evidenceErrorCopy(added)} The URL fetch was reserved separately, so no partial evidence was attached to the bundle.`, request.session, undefined, [evidenceBundleCard(created.data, "Task evidence draft")]);
  }
  return respond(
    "I saved a bounded snapshot of that URL as Cerbanimo evidence.",
    request.session,
    undefined,
    [evidenceBundleCard(added.data, "Task evidence draft")]
  );
}

async function supersedeEvidenceBundle(request: ChatTurnRequest, taskId: string, bundleId: string): Promise<ChatTurnResponse> {
  const result = await new CerbanimoClient(request.auth).supersedeEvidenceBundle(taskId, bundleId);
  if (!result.ok || !result.data) {
    return respond(`Cerbanimo could not start a superseding evidence draft: ${evidenceErrorCopy(result)}`, request.session);
  }
  return respond(
    "I started a new evidence draft linked to the earlier validation result. The older bundle stays frozen for audit; add only the missing evidence here, then preview again.",
    request.session,
    undefined,
    [evidenceBundleCard(result.data, "Superseding evidence draft")]
  );
}

async function cancelEvidenceBundle(request: ChatTurnRequest, taskId: string, bundleId: string): Promise<ChatTurnResponse> {
  const result = await new CerbanimoClient(request.auth).cancelEvidenceBundle(taskId, bundleId);
  if (!result.ok || !result.data) {
    return respond(`Cerbanimo could not cancel that evidence bundle: ${evidenceErrorCopy(result)}`, request.session);
  }
  return respond(
    "Cerbanimo cancelled the evidence bundle and fenced any linked validation action or run.",
    request.session,
    undefined,
    [evidenceBundleCard(result.data, "Cancelled evidence bundle")]
  );
}

async function previewEvidenceSubmission(request: ChatTurnRequest, taskId: string): Promise<ChatTurnResponse> {
  const cerbanimo = new CerbanimoClient(request.auth);
  const current = await cerbanimo.taskEvidence(taskId);
  const existing = current.data?.bundles?.find((bundle) => ["draft", "previewed"].includes(String(bundle.status)));
  const created = existing
    ? { ok: true as const, data: { ...(current.data ?? {}), bundle: existing } }
    : await cerbanimo.createEvidenceBundle(taskId);
  if (!created.ok || !created.data?.bundle) {
    return respond(`I could not prepare the evidence draft in Cerbanimo: ${created.ok ? "No editable bundle was returned." : created.error}`, request.session);
  }
  const preview = await cerbanimo.previewEvidenceBundle(taskId, created.data.bundle.bundle_uuid ?? created.data.bundle.id);
  if (!preview.ok || !preview.data?.action) {
    return respond(`Cerbanimo could not create an evidence submission preview: ${preview.error}`, request.session, undefined, [evidenceBundleCard(created.data, "Task evidence draft")]);
  }
  const action = evidencePreviewFromContext(preview.data, taskId);
  return respond(
    "I prepared the Cerbanimo evidence submission preview. Confirm only when the evidence bundle is ready for validation.",
    { ...request.session, pendingAction: action },
    undefined,
    [evidenceBundleCard(preview.data, "Evidence submission preview"), actionPreviewCard(action)]
  );
}

function parseTaskAutomationCommand(message: string): { kind: "prepare" | "quality_checks"; taskId: string; inputValues: Record<string, unknown> } | undefined {
  const prepare = message.match(/^(?:prepare task automation|view required inputs)\s+(\S+)(.*)$/i);
  if (prepare?.[1]) {
    return { kind: "prepare", taskId: prepare[1], inputValues: parseKeyValueInputs(prepare[2] ?? "") };
  }

  const quality = message.match(/^(?:review|run)\s+quality(?:-|\s*)checks(?:\s+run)?\s+(\S+)/i);
  if (quality?.[1]) {
    return { kind: "quality_checks", taskId: quality[1], inputValues: {} };
  }

  return undefined;
}

function parseTaskEvidenceCommand(message: string): TaskEvidenceCommand | undefined {
  const trimmed = message.trim();
  const supersede = trimmed.match(/^add\s+more\s+evidence\s+(\S+)\s+(\S+)$/i)
    ?? trimmed.match(/^supersede\s+evidence\s+(\S+)\s+(\S+)$/i);
  if (supersede?.[1] && supersede[2]) return { kind: "supersede", taskId: supersede[1], bundleId: supersede[2] };

  const cancel = trimmed.match(/^cancel\s+evidence\s+(\S+)\s+(\S+)$/i);
  if (cancel?.[1] && cancel[2]) return { kind: "cancel", taskId: cancel[1], bundleId: cancel[2] };

  const requirements = trimmed.match(/^(?:view\s+)?(?:evidence\s+requirements|requirements\s+for\s+evidence)\s+(\S+)$/i);
  if (requirements?.[1]) return { kind: "requirements", taskId: requirements[1] };

  const preview = trimmed.match(/^preview\s+evidence(?:\s+submission)?\s+(\S+)$/i);
  if (preview?.[1]) return { kind: "preview", taskId: preview[1] };

  const addUrl = trimmed.match(/^(?:add|fetch)\s+(?:url\s+)?evidence(?:\s+url)?\s+(\S+)\s+(https?:\/\/\S+)$/i)
    ?? trimmed.match(/^submit\s+(?:evidence|task)\s+(\S+)\s+(https?:\/\/\S+)$/i);
  if (addUrl?.[1] && addUrl[2]) return { kind: "fetch_url", taskId: addUrl[1], url: addUrl[2] };

  const addText = trimmed.match(/^(?:add\s+(?:text\s+)?evidence|proof)\s+(\S+)\s+([\s\S]+)$/i)
    ?? trimmed.match(/^submit\s+(?:evidence|task)\s+(\S+)\s+([\s\S]+)$/i);
  if (addText?.[1] && addText[2]) return { kind: "add_text", taskId: addText[1], text: addText[2].trim() };

  const start = trimmed.match(/^(?:\/submit|submit\s+(?:evidence|task)|start\s+evidence)\s+(\S+)$/i);
  if (start?.[1]) return { kind: "start", taskId: start[1] };

  return undefined;
}

function parseReviewCommand(message: string): ReviewCommand | undefined {
  const trimmed = message.trim();
  if (/^\/reviews?$|^review assignments$|^review queue$/i.test(trimmed)) return { kind: "queue" };

  const status = trimmed.match(/^review status\s+(\S+)$/i) ?? trimmed.match(/^task review status\s+(\S+)$/i);
  if (status?.[1]) return { kind: "status", taskId: status[1] };

  const open = trimmed.match(/^open review\s+(\S+)$/i);
  if (open?.[1]) return { kind: "open", assignmentId: open[1] };

  const accept = trimmed.match(/^accept review\s+(\S+)$/i);
  if (accept?.[1]) return { kind: "accept", assignmentId: accept[1] };

  const decline = trimmed.match(/^decline review\s+(\S+)(?:\s+reason=(.+))?$/i);
  if (decline?.[1]) return { kind: "decline", assignmentId: decline[1], reason: decline[2] };

  const recuse = trimmed.match(/^recuse review\s+(\S+)(?:\s+reason=(.+))?$/i);
  if (recuse?.[1]) return { kind: "recuse", assignmentId: recuse[1], reason: recuse[2] ?? "Reviewer recused from Kamiya." };

  const validation = trimmed.match(/^validation review\s+(\S+)\s+(accept_validation|request_more_evidence|reject_invalid_evidence|recuse)(?:\s+reason=(.+))?$/i);
  if (validation?.[1]) return { kind: "validation_decision", reviewId: validation[1], decision: validation[2], reason: validation[3] };

  const bless = trimmed.match(/^bless review\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (bless?.[1]) {
    const { assignmentId, reason } = splitOptionalAssignmentAndReason(bless[2]);
    return { kind: "peer_decision", roundId: bless[1], assignmentId, decision: "bless", reason };
  }

  const requestChanges = trimmed.match(/^request review changes\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (requestChanges?.[1]) {
    const { assignmentId, reason } = splitOptionalAssignmentAndReason(requestChanges[2]);
    return { kind: "peer_decision", roundId: requestChanges[1], assignmentId, decision: "request_changes", reason: reason ?? "Reviewer requested more specific evidence." };
  }

  const reject = trimmed.match(/^reject review\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (reject?.[1]) {
    const { assignmentId, reason } = splitOptionalAssignmentAndReason(reject[2]);
    return { kind: "peer_decision", roundId: reject[1], assignmentId, decision: "reject", reason: reason ?? "Reviewer rejected the evidence." };
  }

  const seal = trimmed.match(/^seal review\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (seal?.[1]) {
    const { assignmentId, reason } = splitOptionalAssignmentAndReason(seal[2]);
    return { kind: "pm_decision", roundId: seal[1], assignmentId, decision: "seal", reason };
  }

  const pmChanges = trimmed.match(/^pm request changes\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (pmChanges?.[1]) {
    const { assignmentId, reason } = splitOptionalAssignmentAndReason(pmChanges[2]);
    return { kind: "pm_decision", roundId: pmChanges[1], assignmentId, decision: "request_changes", reason: reason ?? "Project review requested changes." };
  }

  return undefined;
}

function splitOptionalAssignmentAndReason(input?: string): { assignmentId?: string; reason?: string } {
  const text = input?.trim();
  if (!text) return {};

  const reasonMatch = text.match(/\breason=/i);
  const beforeReason = reasonMatch ? text.slice(0, reasonMatch.index).trim() : text;
  const reason = reasonMatch ? text.slice((reasonMatch.index ?? 0) + reasonMatch[0].length).trim() : undefined;
  const assignmentId = beforeReason ? beforeReason.split(/\s+/)[0] : undefined;
  return {
    assignmentId,
    reason: reason || undefined
  };
}

function peerDecisionCopy(decision: string): string {
  if (decision === "bless") return "Blessing recorded. Kamiya will show the peer gate progress from Cerbanimo.";
  if (decision === "request_changes") return "Changes requested. Timeout advancement is blocked for this review round.";
  if (decision === "reject") return "Peer rejection recorded. The task is not completed and no rewards are issued.";
  return "Peer review decision recorded.";
}

function pmDecisionCopy(decision: string): string {
  if (decision === "seal") return "Ritual Seal recorded. The contribution is accepted pending settlement; completion and rewards wait for Packet 009.";
  if (decision === "request_changes") return "Project review requested changes. The evidence remains immutable and the contributor can create a superseding bundle.";
  if (decision === "reject") return "Project rejection recorded. The task remains uncompleted and no settlement occurred.";
  return "PM review decision recorded.";
}

function taskIdFromMessageOrIntent(message: string, intent?: ChatMessage["intent"]): string | undefined {
  const fromEntity = intent?.entities?.taskId ?? intent?.entities?.task_id ?? intent?.entities?.task;
  if (typeof fromEntity === "string" || typeof fromEntity === "number") return String(fromEntity);
  const match = message.match(/\b(?:task|submit|evidence)\s+#?(\d+)\b/i) ?? message.match(/^\/submit\s+(\S+)/i);
  return match?.[1];
}

function evidencePreviewFromContext(context: Parameters<typeof evidenceBundleCard>[0], taskId: string): NonNullable<ChatTurnResponse["session"]["pendingAction"]> {
  const action = context.action;
  const bundle = context.bundle;
  const previewPayload = action?.preview_payload ?? {};
  return {
    id: crypto.randomUUID(),
    kind: "submit_task",
    title: String(previewPayload.title ?? `Submit evidence for task ${taskId}`),
    summary: String(previewPayload.summary ?? "Cerbanimo will freeze the evidence bundle and validate it before moving the task to review."),
    risk: normalizeRisk(action?.risk_level),
    destructive: false,
    payload: {
      taskId,
      bundleId: bundle?.bundle_uuid ?? bundle?.id
    },
    requiredPermissions: ["tasks:write", "actions:write"],
    createdAt: String(action?.created_at ?? new Date().toISOString()),
    cerbanimoActionId: action ? String(action.id) : undefined,
    cerbanimoActionUuid: action?.action_uuid ?? undefined,
    functionName: "tasks.submit_evidence"
  };
}

function parseKeyValueInputs(value: string): Record<string, unknown> {
  const inputValues: Record<string, unknown> = {};
  const pattern = /([A-Za-z][A-Za-z0-9_:-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  for (const match of value.matchAll(pattern)) {
    const raw = match[2] ?? match[3] ?? match[4] ?? "";
    if (/^(yes|true|approved)$/i.test(raw)) inputValues[match[1]] = true;
    else if (/^(no|false)$/i.test(raw)) inputValues[match[1]] = false;
    else inputValues[match[1]] = raw;
  }
  return inputValues;
}

function automationPreviewFromTaskContext(context: TaskAutomationContext): NonNullable<ChatTurnResponse["session"]["pendingAction"]> {
  const action = context.action;
  const taskName = String(context.task.name ?? context.task.title ?? `Task ${context.task.id}`);
  const previewPayload = action?.preview_payload ?? {};
  return {
    id: crypto.randomUUID(),
    kind: "run_automation",
    title: String(previewPayload.title ?? `Run quality checks for ${taskName}`),
    summary: String(previewPayload.summary ?? "Cerbanimo will run quality checks after confirmation."),
    risk: normalizeRisk(action?.risk_level),
    destructive: false,
    payload: {
      taskId: context.task.id,
      preparationId: context.preparation?.id,
      capabilityName: context.preparation?.capability_name ?? "github.run_quality_checks"
    },
    requiredPermissions: ["automation:write", "actions:write"],
    createdAt: String(action?.created_at ?? new Date().toISOString()),
    cerbanimoActionId: action ? String(action.id) : undefined,
    cerbanimoActionUuid: action?.action_uuid ?? undefined,
    functionName: "tasks.run_automation"
  };
}

function normalizeRisk(value: unknown): "low" | "medium" | "high" {
  const risk = String(value ?? "low").toLowerCase();
  if (risk === "high" || risk === "destructive") return "high";
  if (risk === "medium" || risk === "normal") return "medium";
  return "low";
}

function isAutomationRunRecord(value: unknown): value is Parameters<typeof automationRunResultCard>[0] {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "id" in value && "status" in value;
}

function automationHistoryStatus(value: unknown): "queued" | "running" | "completed" | "failed" | "cancelled" {
  if (!isAutomationRunRecord(value)) return "queued";
  const status = String(value.status);
  if (status === "cancelled") return "cancelled";
  if (status === "failed" || status === "blocked") return "failed";
  if (status === "completed") return "completed";
  if (status === "running") return "running";
  return "queued";
}

function automationConfirmationMessage(value: unknown): string {
  if (!isAutomationRunRecord(value)) return "Confirmed. Cerbanimo accepted the automation action, but the run state was not available yet.";
  const status = String(value.status);
  const resultStatus = value.result && typeof value.result === "object" && !Array.isArray(value.result)
    ? String((value.result as Record<string, unknown>).status ?? "")
    : "";
  if (status === "completed" && resultStatus) return "Confirmed. Cerbanimo finalized the automation run and returned the report below.";
  if (status === "blocked" || status === "failed") return "Confirmed, but Cerbanimo says this automation needs attention before it can finish.";
  if (status === "cancelled") return "Cerbanimo shows this automation run as cancelled.";
  return "Confirmed. Cerbanimo queued the automation run. The run card below is the source of truth while the worker processes it.";
}

function evidenceConfirmationMessage(value: unknown): string {
  if (!isAutomationRunRecord(value)) return "Confirmed. Cerbanimo accepted the evidence submission, but the validation run was not available yet.";
  const resultStatus = value.result && typeof value.result === "object" && !Array.isArray(value.result)
    ? String((value.result as Record<string, unknown>).status ?? "")
    : "";
  if (resultStatus === "validation_passed") return "Confirmed. Cerbanimo validated the evidence and moved the task into review.";
  if (resultStatus === "needs_more_evidence") return "Confirmed. Cerbanimo validated the bundle and needs more evidence before review.";
  if (resultStatus === "manual_review_required") return "Confirmed. Cerbanimo could not safely decide this automatically, so it routed the evidence to manual validation review.";
  if (resultStatus === "validation_failed") return "Confirmed, but Cerbanimo rejected the evidence during validation.";
  return "Confirmed. Cerbanimo queued the evidence validation run. The validation card below is the source of truth while the worker processes it.";
}

function evidenceErrorCopy(result: { error?: string; code?: string | number }): string {
  const code = String(result.code ?? "");
  if (/MEDIA_TYPE|BASE64|POLYGLOT|TOO_LARGE|EMPTY_FILE/i.test(code)) {
    return `${result.error ?? "The upload was rejected by Cerbanimo's evidence safety checks."} Try a JPEG, PNG, WebP, PDF, or plain text file. SVGs, executables, archives, macros, and unknown binaries are not accepted.`;
  }
  if (/PRIVATE_NETWORK|FETCH_TIMEOUT|NON_2XX|URL_NOT_ALLOWED|BAD_REDIRECT/i.test(code)) {
    return `${result.error ?? "The URL snapshot was rejected by Cerbanimo's fetch safety checks."} Use a public HTTPS URL that does not redirect to private or reserved infrastructure.`;
  }
  if (/OWNER|AUTH|DENIED|FORBIDDEN/i.test(code)) {
    return `${result.error ?? "Cerbanimo denied this evidence operation."} Evidence drafts can only be changed by their owning contributor or an audited service operation.`;
  }
  return result.error ?? "Cerbanimo returned an evidence error.";
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
