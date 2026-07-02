import type { KamiyaAuthContext } from "../../shared/types";

const authSessionKey = "cerbanimo_auth_bridge";
const accessTokenKey = "cerbanimo_access_token";
const defaultCerbanimoOrigin = "http://localhost:3000";
const defaultCerbanimoApiBase = "http://localhost:4000";

export interface CerbanimoBridgeUser {
  sub?: string;
  name?: string;
  nickname?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
}

interface CerbanimoAuthBridgeSuccess {
  type: "CERBANIMO_AUTH_BRIDGE_SUCCESS";
  tokenType: "Bearer";
  accessToken: string;
  expiresAt?: string | number;
  audience?: string;
  user?: CerbanimoBridgeUser;
  nonce: string;
}

interface CerbanimoAuthBridgeError {
  type: "CERBANIMO_AUTH_BRIDGE_ERROR";
  error?: string;
  errorDescription?: string;
  message?: string;
  nonce: string;
}

type CerbanimoAuthBridgeMessage = CerbanimoAuthBridgeSuccess | CerbanimoAuthBridgeError;

interface StoredCerbanimoSession {
  tokenType: "Bearer";
  accessToken: string;
  expiresAt?: string | number;
  audience?: string;
  user?: CerbanimoBridgeUser;
}

export interface LoginResult {
  auth: KamiyaAuthContext;
  session: StoredCerbanimoSession;
}

export function cerbanimoOrigin(): string {
  return import.meta.env.VITE_CERBANIMO_ORIGIN ?? defaultCerbanimoOrigin;
}

export function cerbanimoApiBase(): string {
  return import.meta.env.VITE_CERBANIMO_API_BASE ?? defaultCerbanimoApiBase;
}

export function hydrateAuthFromCerbanimoSession(auth: KamiyaAuthContext): KamiyaAuthContext {
  const session = getStoredCerbanimoSession();
  if (!session) return auth;

  return {
    ...auth,
    isLoggedIn: true,
    userId: getUserId(session.user),
    displayName: getDisplayName(session.user) ?? auth.displayName,
    permissions: auth.permissions ?? ["projects:create", "tasks:submit", "automation:create"]
  };
}

export function attachCerbanimoAuth(auth: KamiyaAuthContext): KamiyaAuthContext {
  const session = getStoredCerbanimoSession();
  if (!session) return auth;

  return {
    ...auth,
    isLoggedIn: true,
    userId: getUserId(session.user) ?? auth.userId,
    displayName: getDisplayName(session.user) ?? auth.displayName,
    cerbanimoApiUrl: cerbanimoApiBase(),
    cerbanimoToken: session.accessToken
  };
}

export function getCerbanimoAccessToken(): string | undefined {
  return getStoredCerbanimoSession()?.accessToken ?? readStorage(sessionStorage, accessTokenKey) ?? readStorage(localStorage, accessTokenKey) ?? undefined;
}

export function clearCerbanimoSession(): void {
  sessionStorage.removeItem(authSessionKey);
  sessionStorage.removeItem(accessTokenKey);
  localStorage.removeItem(authSessionKey);
  localStorage.removeItem(accessTokenKey);
}

export function startCerbanimoLogin(): Promise<LoginResult> {
  const nonce = crypto.randomUUID();
  const origin = cerbanimoOrigin();
  const returnOrigin = window.location.origin;
  const loginUrl = `${origin}/auth/bridge/start?return_origin=${encodeURIComponent(returnOrigin)}&nonce=${encodeURIComponent(nonce)}`;
  const popup = window.open(loginUrl, "cerbanimo-login", "width=520,height=720");

  if (!popup) {
    return Promise.reject(new Error("Kamiya could not open the Cerbanimo login popup. Allow popups for this site and try again."));
  }
  const loginPopup = popup;

  return new Promise((resolve, reject) => {
    const closeCheck = window.setInterval(() => {
      if (loginPopup.closed) {
        cleanup();
        reject(new Error("Cerbanimo login was closed before it completed."));
      }
    }, 500);

    const timeout = window.setTimeout(() => {
      cleanup();
      loginPopup.close();
      reject(new Error("Cerbanimo login timed out before returning an auth bridge response."));
    }, 120_000);

    function cleanup(): void {
      window.clearInterval(closeCheck);
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event: MessageEvent<unknown>): void {
      if (event.origin !== origin) return;
      if (!isBridgeMessage(event.data) || event.data.nonce !== nonce) return;

      cleanup();
      loginPopup.close();

      if (event.data.type === "CERBANIMO_AUTH_BRIDGE_ERROR") {
        reject(new Error(event.data.errorDescription ?? event.data.message ?? event.data.error ?? "Cerbanimo login failed."));
        return;
      }

      const session: StoredCerbanimoSession = {
        tokenType: event.data.tokenType,
        accessToken: event.data.accessToken,
        expiresAt: event.data.expiresAt,
        audience: event.data.audience,
        user: event.data.user
      };
      writeSession(session);

      resolve({
        session,
        auth: hydrateAuthFromCerbanimoSession({
          isLoggedIn: true,
          permissions: ["projects:create", "tasks:submit", "automation:create"]
        })
      });
    }

    window.addEventListener("message", handleMessage);
    loginPopup.focus();
  });
}

function getStoredCerbanimoSession(): StoredCerbanimoSession | undefined {
  const raw = readStorage(sessionStorage, authSessionKey) ?? readStorage(localStorage, authSessionKey);
  if (!raw) return undefined;

  try {
    const session = JSON.parse(raw) as StoredCerbanimoSession;
    if (!session.accessToken || isExpired(session.expiresAt)) {
      clearCerbanimoSession();
      return undefined;
    }
    writeSession(session);
    return session;
  } catch {
    clearCerbanimoSession();
    return undefined;
  }
}

function writeSession(session: StoredCerbanimoSession): void {
  const raw = JSON.stringify(session);
  sessionStorage.setItem(authSessionKey, raw);
  localStorage.setItem(authSessionKey, raw);
  sessionStorage.setItem(accessTokenKey, session.accessToken);
  localStorage.setItem(accessTokenKey, session.accessToken);
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function isExpired(expiresAt: string | number | undefined): boolean {
  if (!expiresAt) return false;
  const expiryMs = typeof expiresAt === "number" ? normalizeEpoch(expiresAt) : Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return false;
  return expiryMs <= Date.now();
}

function normalizeEpoch(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function isBridgeMessage(data: unknown): data is CerbanimoAuthBridgeMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Partial<CerbanimoAuthBridgeMessage>;
  if (message.type === "CERBANIMO_AUTH_BRIDGE_ERROR") return typeof message.nonce === "string";
  return message.type === "CERBANIMO_AUTH_BRIDGE_SUCCESS" && message.tokenType === "Bearer" && typeof message.accessToken === "string" && typeof message.nonce === "string";
}

function getUserId(user: CerbanimoBridgeUser | undefined): string | undefined {
  return user?.sub;
}

function getDisplayName(user: CerbanimoBridgeUser | undefined): string | undefined {
  return user?.name ?? user?.nickname ?? user?.email;
}
