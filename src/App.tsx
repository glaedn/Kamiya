import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, LogIn, LogOut, Send, Settings, Slash, Sparkles } from "lucide-react";
import type { CardAction, ChatMessage, KamiyaAuthContext, KamiyaSavedChatSummary, KamiyaSessionState } from "../shared/types";
import { slashCommands } from "../shared/commands";
import { CommandMenu } from "./components/CommandMenu";
import { MessageBubble } from "./components/MessageBubble";
import { SettingsPanel } from "./components/SettingsPanel";
import { hydrateAction, listSavedChats, loadSavedChat, makeUserMessage, sendChatTurn } from "./lib/kamiyaApi";
import { loadAuth, loadSession, saveAuth, saveSession } from "./lib/storage";
import { attachCerbanimoAuth, bootstrapLocalE2EAuthFromQuery, clearCerbanimoSession, hydrateAuthFromCerbanimoSession, startCerbanimoLogin } from "./lib/authBridge";

bootstrapLocalE2EAuthFromQuery();

export default function App() {
  const [auth, setAuth] = useState<KamiyaAuthContext>(() => hydrateAuthFromCerbanimoSession(loadAuth()));
  const [session, setSession] = useState<KamiyaSessionState>(() => loadSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [introMessage(hydrateAuthFromCerbanimoSession(loadAuth()).isLoggedIn)]);
  const [savedChats, setSavedChats] = useState<KamiyaSavedChatSummary[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef(session);
  const authRef = useRef(auth);
  const hydrationMessageIdRef = useRef<string | undefined>();
  const networkNoticeRef = useRef(false);
  const isSendingRef = useRef(false);

  const statusLabel = auth.isLoggedIn ? auth.displayName || "Connected" : "Logged out";
  const quickCommands = useMemo(() => slashCommands.slice(0, 6), []);
  const activeActionSignature = useMemo(() => {
    const active = session.activeAction;
    if (!active) return "";
    return `${active.actionUuid ?? active.actionId}:${active.status}`;
  }, [session.activeAction]);

  useEffect(() => {
    saveAuth(auth);
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    sessionRef.current = session;
    saveSession(session);
  }, [session]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].role !== "assistant") return current;
      return [introMessage(auth.isLoggedIn)];
    });
  }, [auth.isLoggedIn]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshSavedChats = useCallback(async () => {
    try {
      setSavedChats(await listSavedChats(attachCerbanimoAuth(auth)));
    } catch {
      setSavedChats([]);
    }
  }, [auth]);

  useEffect(() => {
    const active = sessionRef.current.activeAction;
    if (!auth.isLoggedIn || !active || (!shouldPollStatus(active.status) && !isTerminalStatus(active.status))) return undefined;
    const initialActionId = active.actionUuid ?? active.actionId;

    let stopped = false;
    let timer: number | undefined;
    let inFlight = false;
    let delay = 900;
    let controller: AbortController | undefined;

    async function poll(): Promise<void> {
      if (stopped || inFlight) return;
      inFlight = true;
      controller = new AbortController();

      try {
        const latestSession = sessionRef.current;
        const latestActive = latestSession.activeAction;
        const actionId = latestActive?.actionUuid ?? latestActive?.actionId ?? initialActionId;
        const response = await hydrateAction(attachCerbanimoAuth(authRef.current), latestSession, actionId, controller.signal);
        networkNoticeRef.current = false;
        setSession(response.session);
        mergeHydrationMessage(response.message);

        const nextStatus = response.session.activeAction?.status;
        if (nextStatus && isTerminalStatus(nextStatus)) return;
        delay = Math.min(3000, Math.round(delay * 1.35));
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === "AbortError")) {
          if (!networkNoticeRef.current) {
            networkNoticeRef.current = true;
            setMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "The connection to Cerbanimo was interrupted. I will keep this quest recoverable and continue hydrating the same action.",
                createdAt: new Date().toISOString()
              }
            ]);
          }
          delay = Math.min(3000, delay + 500);
        }
      } finally {
        inFlight = false;
        if (!stopped && shouldPollStatus(sessionRef.current.activeAction?.status)) {
          timer = window.setTimeout(() => void poll(), delay);
        }
      }
    }

    void poll();

    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") void poll();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeActionSignature, auth.isLoggedIn]);

  async function submitMessage(value = input) {
    const trimmed = value.trim();
    if (!trimmed || isSendingRef.current) return;

    const userMessage = makeUserMessage(trimmed);
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    isSendingRef.current = true;
    setIsSending(true);

    try {
      const response = await sendChatTurn({
        message: trimmed,
        history: nextHistory,
        session,
        auth: attachCerbanimoAuth(auth)
      });
      setSession(response.session);
      if (shouldPollStatus(response.session.activeAction?.status)) {
        hydrationMessageIdRef.current = response.message.id;
      }
      setMessages((current) => [...current, response.message]);
      void refreshSavedChats();
    } catch (error) {
      const content = error instanceof Error ? error.message : "Kamiya hit an unknown error.";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage();
  }

  function handleCardAction(action: CardAction) {
    if (isSendingRef.current) return;
    if (action.id === "confirm") {
      void submitMessage("confirm");
      return;
    }
    if (action.command) {
      void submitMessage(action.command);
    }
  }

  async function handleLogin() {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(undefined);

    try {
      const result = await startCerbanimoLogin();
      setAuth((current) => ({ ...current, ...result.auth, isLoggedIn: true }));
      setSettingsOpen(false);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Cerbanimo login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    clearCerbanimoSession();
    setSavedChats([]);
    startNewChat(false);
    setAuth((current) => ({
      isLoggedIn: false,
      displayName: current.displayName,
      permissions: current.permissions ?? ["projects:create", "tasks:submit", "automation:create"]
    }));
  }

  function startNewChat(useCurrentAuth = true) {
    const isLoggedIn = useCurrentAuth ? auth.isLoggedIn : false;
    setSession({});
    hydrationMessageIdRef.current = undefined;
    setMessages([introMessage(isLoggedIn)]);
    setInput("");
  }

  useEffect(() => {
    if (!auth.isLoggedIn) {
      setSavedChats([]);
      return;
    }

    void refreshSavedChats();
  }, [auth.isLoggedIn, auth.userId, refreshSavedChats]);

  async function handleLoadChat(chatIdValue: string) {
    if (!chatIdValue) {
      startNewChat();
      return;
    }

    try {
      const chat = await loadSavedChat(attachCerbanimoAuth(auth), Number(chatIdValue));
      setSession({ ...(chat.session ?? {}), chatId: chat.id, chatName: chat.name });
      setMessages(chat.messages?.length ? chat.messages : [introMessage(auth.isLoggedIn)]);
    } catch (error) {
      const content = error instanceof Error ? error.message : "Failed to load that Kamiya chat.";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }

  function mergeHydrationMessage(message: ChatMessage) {
    const existingId = hydrationMessageIdRef.current;
    if (!existingId) {
      hydrationMessageIdRef.current = message.id;
      setMessages((current) => [...current, message]);
      return;
    }

    setMessages((current) => {
      const index = current.findIndex((item) => item.id === existingId);
      if (index === -1) {
        hydrationMessageIdRef.current = message.id;
        return [...current, message];
      }
      const next = [...current];
      next[index] = { ...message, id: existingId };
      return next;
    });
  }

  return (
    <main className="app-shell">
      <section className="chat-panel" aria-label="Kamiya chat">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <h1>Kamiya</h1>
              <p>Project management and automation assistant</p>
            </div>
          </div>

          <div className="topbar-actions">
            <select
              className="chat-select"
              value={session.chatId ?? ""}
              onChange={(event) => void handleLoadChat(event.target.value)}
              aria-label="Select Kamiya chat"
            >
              <option value="">New chat</option>
              {savedChats.length ? null : <option disabled>No saved chats yet</option>}
              {savedChats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.name}{chat.messageCount ? ` (${chat.messageCount})` : ""}
                </option>
              ))}
            </select>
            <button className="secondary auth-button" type="button" onClick={() => startNewChat()}>
              New
            </button>
            <span className={auth.isLoggedIn ? "status connected" : "status"}>{statusLabel}</span>
            <button className="secondary auth-button" type="button" onClick={auth.isLoggedIn ? handleLogout : handleLogin} disabled={isLoggingIn}>
              {auth.isLoggedIn ? <LogOut size={16} /> : <LogIn size={16} />}
              {isLoggingIn ? "Opening..." : auth.isLoggedIn ? "Log out" : "Log in"}
            </button>
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onCardAction={handleCardAction} isBusy={isSending} />
          ))}
          {isSending ? (
            <div className="message assistant">
              <div className="bubble typing">
                <Bot size={16} />
                <span>Kamiya is thinking</span>
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="quick-strip" aria-label="Common commands">
          {quickCommands.map((command) => (
            <button key={command.name} type="button" onClick={() => setInput(`${command.name} `)}>
              <Slash size={14} />
              {command.name.slice(1)}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <CommandMenu input={input} onPick={setInput} />
          <textarea
            aria-label="Message Kamiya"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            placeholder={auth.isLoggedIn ? "What is your quest?" : "Type / to browse commands or log in to begin."}
            rows={1}
          />
          <button className="send-button" type="submit" disabled={!input.trim() || isSending} aria-label="Send message">
            <Send size={18} />
          </button>
        </form>
      </section>

      <aside className="context-panel" aria-label="Kamiya context">
        <div className="context-block">
          <h2>Mode</h2>
          <div className="mode-row">
            <strong>{session.mode ?? "auto"}</strong>
            <button className="secondary" type="button" onClick={() => void submitMessage("/mode")}>
              Change
            </button>
          </div>
        </div>

        <div className="context-block">
          <h2>Action Queue</h2>
          {session.pendingAction ? (
            <div className="pending-action">
              <strong>{session.pendingAction.title}</strong>
              <p>{session.pendingAction.summary}</p>
              <button className="primary wide" type="button" onClick={() => void submitMessage("confirm")}>
                {session.pendingAction.kind === "create_project" ? "Confirm quest creation" : "Confirm action"}
              </button>
            </div>
          ) : (
            <p>No pending actions. Modifying requests will appear here before execution.</p>
          )}
        </div>

        <div className="context-block">
          <h2>Action History</h2>
          {session.actionHistory?.length ? (
            <div className="history-list">
              {session.actionHistory.slice(0, 5).map((action) => (
                <div key={action.id} className="history-row">
                  <strong>{action.title}</strong>
                  <span>{action.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>Confirmed automations and mutations will appear here.</p>
          )}
        </div>

        <div className="context-block">
          <h2>Planning Draft</h2>
          {session.planningDraft ? (
            <dl className="draft-list">
              {projectDraftEntries(session.planningDraft).map(([key, value]) => (
                <div key={key}>
                  <dt>{humanize(key)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Start with `/plan` and describe the quest you want to create.</p>
          )}
        </div>

        <div className="context-block">
          <h2>Core Boundary</h2>
          <p>Kamiya interprets intent, previews actions, and renders results. Cerbanimo remains the source of truth.</p>
          <button className="secondary wide boundary-button" type="button" onClick={() => void submitMessage("/help")}>
            Show clients
          </button>
        </div>
      </aside>

      <SettingsPanel
        auth={auth}
        open={settingsOpen}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
        onClose={() => setSettingsOpen(false)}
        onChange={setAuth}
        onLogin={() => void handleLogin()}
        onLogout={handleLogout}
      />
    </main>
  );
}

function isTerminalStatus(status?: string): boolean {
  return status === "completed" || status === "executed" || status === "blocked" || status === "failed" || status === "cancelled";
}

function shouldPollStatus(status?: string): boolean {
  return status === "confirmed" || status === "queued" || status === "running" || status === "retry_wait";
}

function introMessage(isLoggedIn: boolean): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    content: isLoggedIn
      ? "Hello! I'm Kamiya, your project management and automation assistant.\n\nDream up a quest or endeavor, big or small, and I'll help turn it into reality.\n\nWhat is your quest?"
      : "Hello! I'm Kamiya, your project management and automation assistant.\n\nDream up a quest or endeavor, big or small, and I'll help turn it into reality.\n\nType \"/\" to browse commands or log in to begin."
  };
}

function humanize(key: string): string {
  const labels: Record<string, string> = {
    title: "Title",
    mission: "Description",
    desiredOutcome: "Desired outcome",
    timeline: "Deadline",
    constraints: "Constraints"
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function projectDraftEntries(draft: KamiyaSessionState["planningDraft"]): Array<[string, string]> {
  if (!draft) return [];
  return (["title", "mission", "desiredOutcome", "timeline", "constraints"] as const)
    .map((key) => [key, draft[key]] as [string, string | undefined])
    .filter((entry): entry is [string, string] => Boolean(entry[1]));
}
