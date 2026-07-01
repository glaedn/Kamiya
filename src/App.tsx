import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Settings, Slash, Sparkles } from "lucide-react";
import type { CardAction, ChatMessage, KamiyaAuthContext, KamiyaSessionState } from "../shared/types";
import { slashCommands } from "../shared/commands";
import { CommandMenu } from "./components/CommandMenu";
import { MessageBubble } from "./components/MessageBubble";
import { SettingsPanel } from "./components/SettingsPanel";
import { makeUserMessage, sendChatTurn } from "./lib/kamiyaApi";
import { loadAuth, loadSession, saveAuth, saveSession } from "./lib/storage";

export default function App() {
  const [auth, setAuth] = useState<KamiyaAuthContext>(() => loadAuth());
  const [session, setSession] = useState<KamiyaSessionState>(() => loadSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [introMessage(loadAuth().isLoggedIn)]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const statusLabel = auth.isLoggedIn ? auth.displayName || "Connected" : "Logged out";
  const quickCommands = useMemo(() => slashCommands.slice(0, 6), []);

  useEffect(() => {
    saveAuth(auth);
  }, [auth]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].role !== "assistant") return current;
      return [introMessage(auth.isLoggedIn)];
    });
  }, [auth.isLoggedIn]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submitMessage(value = input) {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;

    const userMessage = makeUserMessage(trimmed);
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendChatTurn({
        message: trimmed,
        history: nextHistory,
        session,
        auth
      });
      setSession(response.session);
      setMessages((current) => [...current, response.message]);
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
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage();
  }

  function handleCardAction(action: CardAction) {
    if (action.id === "confirm") {
      void submitMessage("confirm");
      return;
    }
    if (action.command) {
      void submitMessage(action.command);
    }
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
            <span className={auth.isLoggedIn ? "status connected" : "status"}>{statusLabel}</span>
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onCardAction={handleCardAction} />
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
                Confirm action
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
              {Object.entries(session.planningDraft).map(([key, value]) => (
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

      <SettingsPanel auth={auth} open={settingsOpen} onClose={() => setSettingsOpen(false)} onChange={setAuth} />
    </main>
  );
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
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
