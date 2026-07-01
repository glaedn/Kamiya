import type { KamiyaAuthContext, KamiyaSessionState } from "../../shared/types";

const authKey = "kamiya.auth";
const sessionKey = "kamiya.session";

export function loadAuth(): KamiyaAuthContext {
  const raw = localStorage.getItem(authKey);
  if (!raw) {
    return {
      isLoggedIn: false,
      cerbanimoApiUrl: "http://localhost:4000",
      permissions: ["projects:create", "tasks:submit", "automation:create"]
    };
  }

  return {
    permissions: ["projects:create", "tasks:submit", "automation:create"],
    ...JSON.parse(raw)
  };
}

export function saveAuth(auth: KamiyaAuthContext): void {
  localStorage.setItem(authKey, JSON.stringify(auth));
}

export function loadSession(): KamiyaSessionState {
  const raw = localStorage.getItem(sessionKey);
  return raw ? JSON.parse(raw) : {};
}

export function saveSession(session: KamiyaSessionState): void {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}
