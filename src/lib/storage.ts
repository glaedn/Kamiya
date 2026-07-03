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
  return {
    chatId: session.chatId,
    chatName: session.chatName,
    pendingAction: session.pendingAction
      ? {
          ...session.pendingAction,
          payload: {
            name: session.pendingAction.payload.name,
            dueDate: session.pendingAction.payload.dueDate,
            tags: session.pendingAction.payload.tags,
            generationMode: session.pendingAction.payload.generationMode
          }
        }
      : undefined,
    planningDraft: session.planningDraft,
    planningDeadlinePrompted: session.planningDeadlinePrompted,
    mode: session.mode,
    lastProjectAction: undefined,
    actionHistory: session.actionHistory?.slice(0, 5),
    activeAction: session.activeAction
  };
}
