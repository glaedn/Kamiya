import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  ListChecks,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";
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
  workflow_failure: ShieldCheck
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
              </div>
              {item.status ? <em>{item.status}</em> : null}
            </div>
          ))}
        </div>
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

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
