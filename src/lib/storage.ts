import type { KamiyaAuthContext, KamiyaSessionState } from "../../shared/types";

const authKey = "kamiya.auth";
const sessionKey = "kamiya.session";

export function loadAuth(): KamiyaAuthContext {
  const raw = localStorage.getItem(authKey);
  if (!raw) {
    return {
      isLoggedIn: false,
      permissions: ["projects:create", "tasks:submit", "automation:create"]
    };
  }

  return {
    permissions: ["projects:create", "tasks:submit", "automation:create"],
    ...sanitizeAuth(JSON.parse(raw) as KamiyaAuthContext)
  };
}

export function saveAuth(auth: KamiyaAuthContext): void {
  localStorage.setItem(authKey, JSON.stringify(sanitizeAuth(auth)));
}

export function loadSession(): KamiyaSessionState {
  const raw = sessionStorage.getItem(sessionKey);
  return raw ? JSON.parse(raw) : {};
}

export function saveSession(session: KamiyaSessionState): void {
  sessionStorage.setItem(sessionKey, JSON.stringify(sanitizeSession(session)));
}

function sanitizeAuth(auth: KamiyaAuthContext): KamiyaAuthContext {
  const safeAuth = { ...auth };
  delete safeAuth.cerbanimoToken;
  delete safeAuth.cerbanimoApiUrl;
  return safeAuth;
}

function sanitizeSession(session: KamiyaSessionState): KamiyaSessionState {
  const pendingPayload = session.pendingAction?.kind === "settle_task"
    ? {
        settlementId: session.pendingAction.payload.settlementId,
        taskId: session.pendingAction.payload.taskId
      }
    : session.pendingAction
      ? {
          name: session.pendingAction.payload.name,
          dueDate: session.pendingAction.payload.dueDate,
          tags: session.pendingAction.payload.tags,
          generationMode: session.pendingAction.payload.generationMode
        }
      : undefined;

  return {
    chatId: session.chatId,
    chatName: session.chatName,
    pendingAction: session.pendingAction
      ? {
          ...session.pendingAction,
          payload: pendingPayload ?? {}
        }
      : undefined,
    planningDraft: session.planningDraft,
    planningDeadlinePrompted: session.planningDeadlinePrompted,
    mode: session.mode,
    presentationMode: session.presentationMode,
    narrativeIntensity: session.narrativeIntensity,
    statDisplayMode: session.statDisplayMode,
    preferredGenre: session.preferredGenre,
    avoidThemes: session.avoidThemes,
    currentQuestProjectId: session.currentQuestProjectId,
    currentSettlementId: session.currentSettlementId,
    currentSettlementTaskId: session.currentSettlementTaskId,
    lastProjectAction: undefined,
    actionHistory: session.actionHistory?.slice(0, 5),
    activeAction: session.activeAction,
    e2eScenario: session.e2eScenario,
    e2eRunId: session.e2eRunId,
    e2eControlDir: session.e2eControlDir
  };
}
