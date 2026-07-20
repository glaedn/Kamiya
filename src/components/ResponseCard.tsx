import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FolderKanban,
  ScrollText,
  Swords,
  ListChecks,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Workflow
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CardAction, ResponseCard as ResponseCardType } from "../../shared/types";

interface ResponseCardProps {
  card: ResponseCardType;
  onAction: (action: CardAction) => void;
  isBusy?: boolean;
}

const cardIcons = {
  action_preview: ShieldCheck,
  quest_summary: Sparkles,
  search_results: Search,
  stats: BarChart3,
  automation: Workflow,
  action_queue: ListChecks,
  validation_report: ShieldCheck,
  mode: Sparkles,
  integration: Plug,
  help: CheckCircle2,
  project: FolderKanban,
  task: CheckCircle2,
  community: Sparkles,
  profile: CheckCircle2,
  approval: ShieldCheck,
  timeline: BarChart3,
  workflow_progress: Workflow,
  workflow_failure: ShieldCheck,
  evidence: FileCheck2,
  review: FileCheck2,
  review_assignment: ListChecks,
  settlement_progress: Workflow,
  settlement_complete: Trophy,
  settlement_failure: ShieldCheck,
  quest_scroll: ScrollText,
  quest_portal: Sparkles,
  quest_preview: ShieldCheck,
  party_assembly: Swords,
  character_calling: Sparkles,
  quest_opening_scene: ScrollText,
  encounter: Swords,
  quest_ledger: ListChecks,
  chronicle: ScrollText,
  narrative_settings: Sparkles,
  plain_mode: ShieldCheck
};

export function ResponseCard({ card, onAction, isBusy = false }: ResponseCardProps) {
  const Icon = cardIcons[card.kind] ?? Sparkles;

  return (
    <article className={`response-card ${card.kind}`}>
      <header>
        <Icon size={18} />
        <div>
          <h3>{card.title}</h3>
          {card.subtitle ? <p>{card.subtitle}</p> : null}
        </div>
      </header>

      {card.body ? <p className="card-body">{card.body}</p> : null}

      {card.metadata ? (
        <dl className="metadata-grid">
          {Object.entries(card.metadata).map(([key, value]) => (
            <div key={key}>
              <dt>{humanize(key)}</dt>
              <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {card.items?.length ? (
        <div className="card-list">
          {card.items.map((item) => (
            <div key={item.id} className="card-row">
              <div>
                <strong>{item.title}</strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
                {item.metadata ? (
                  <dl className="item-metadata">
                    {Object.entries(item.metadata).map(([key, value]) => (
                      <div key={key}>
                        <dt>{humanize(key)}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
              {item.status ? <em>{item.status}</em> : null}
            </div>
          ))}
        </div>
      ) : null}

      {card.kind === "evidence" && isEditableEvidence(card) ? (
        <EvidenceTurnInDesk card={card} onAction={onAction} isBusy={isBusy} />
      ) : null}

      {card.kind === "review_assignment" && card.actions?.some((action) => /bless|seal|changes|reject|recuse/.test(action.id)) ? (
        <ReviewDecisionDesk card={card} onAction={onAction} isBusy={isBusy} />
      ) : null}

      {card.actions?.length ? (
        <div className="card-actions">
          {card.actions.map((action) => (
            <button
              key={action.id}
              className={action.style === "primary" ? "primary" : action.style === "danger" ? "danger" : "secondary"}
              type="button"
              disabled={isBusy && /confirm|retry|cancel/i.test(action.id)}
              aria-label={action.label}
              onClick={() => onAction(action)}
            >
              {action.label}
              {action.command ? <ExternalLink size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function EvidenceTurnInDesk({ card, onAction, isBusy }: ResponseCardProps) {
  const taskId = String(card.metadata?.taskId ?? "");
  const [evidenceType, setEvidenceType] = useState<"text" | "url">("text");
  const [value, setValue] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || !taskId) return;
    onAction({
      id: `guided-evidence-${evidenceType}`,
      label: evidenceType === "url" ? "Fetch URL evidence" : "Add text evidence",
      command: evidenceType === "url"
        ? `add url evidence ${taskId} ${trimmed}`
        : `add text evidence ${taskId} ${trimmed}`
    });
    setValue("");
  }

  return (
    <form className="guided-desk" aria-label="Guided evidence turn-in" onSubmit={submit}>
      <div className="guided-desk-heading">
        <strong>Evidence turn-in desk</strong>
        <span>Task {taskId}</span>
      </div>
      <fieldset className="segmented-control">
        <legend>Evidence type</legend>
        <label><input type="radio" name={`${card.id}-type`} checked={evidenceType === "text"} onChange={() => setEvidenceType("text")} /> Text report</label>
        <label><input type="radio" name={`${card.id}-type`} checked={evidenceType === "url"} onChange={() => setEvidenceType("url")} /> URL artifact</label>
      </fieldset>
      <label>
        <span>{evidenceType === "url" ? "Source URL" : "Outcome, context, and acceptance-criteria evidence"}</span>
        {evidenceType === "url" ? (
          <input type="url" required value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://…" />
        ) : (
          <textarea required rows={4} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Describe what changed, what was verified, and what a reviewer should inspect." />
        )}
      </label>
      <p className="guided-note">Adding evidence is reversible while the bundle is a draft. “Preview submission” freezes a manifest; confirmation is still separate.</p>
      <button className="secondary" type="submit" disabled={isBusy || !value.trim()}>Add to Cerbanimo draft</button>
    </form>
  );
}

function ReviewDecisionDesk({ card, onAction, isBusy }: ResponseCardProps) {
  const [reason, setReason] = useState("");
  const decisions = card.actions?.filter((action) => /bless|seal|changes|reject|recuse/.test(action.id)) ?? [];
  return (
    <section className="guided-desk" aria-label="Reviewer decision controls">
      <div className="guided-desk-heading"><strong>Reviewer rationale</strong><span>Immutable evidence</span></div>
      <label>
        <span>Reason or actionable correction</span>
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cite the requirement and the evidence that supports this decision." />
      </label>
      <div className="guided-decision-actions">
        {decisions.map((action) => (
          <button
            key={`guided-${action.id}`}
            type="button"
            disabled={isBusy || (!reason.trim() && /changes|reject|recuse/.test(action.id))}
            className={action.style === "danger" ? "danger" : action.style === "primary" ? "primary" : "secondary"}
            onClick={() => onAction({ ...action, command: appendReason(action.command, reason) })}
          >{action.label}</button>
        ))}
      </div>
      <p className="guided-note">Decision controls appear only when Cerbanimo includes the corresponding allowed action.</p>
    </section>
  );
}

function appendReason(command: string | undefined, reason: string): string | undefined {
  if (!command || !reason.trim()) return command;
  return `${command.replace(/\s+reason=.*$/i, "")} reason=${reason.trim()}`;
}

function isEditableEvidence(card: ResponseCardType): boolean {
  return ["draft", "needs_more_evidence", "manual_review_required", "not started"].includes(String(card.subtitle ?? "").toLowerCase());
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
