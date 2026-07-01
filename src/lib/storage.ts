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
  const raw = localStorage.getItem(sessionKey);
  return raw ? JSON.parse(raw) : {};
}

export function saveSession(session: KamiyaSessionState): void {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function sanitizeAuth(auth: KamiyaAuthContext): KamiyaAuthContext {
  const safeAuth = { ...auth };
  delete safeAuth.cerbanimoToken;
  delete safeAuth.cerbanimoApiUrl;
  return safeAuth;
}
