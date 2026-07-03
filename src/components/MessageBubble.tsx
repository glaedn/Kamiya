import type { CardAction, ChatMessage } from "../../shared/types";
import { ResponseCard } from "./ResponseCard";

interface MessageBubbleProps {
  message: ChatMessage;
  onCardAction: (action: CardAction) => void;
  isBusy?: boolean;
}

export function MessageBubble({ message, onCardAction, isBusy = false }: MessageBubbleProps) {
  return (
    <div className={`message ${message.role}`}>
      <div className="bubble">
        {message.content.split("\n").map((line) => (
          <p key={line || crypto.randomUUID()}>{line}</p>
        ))}
      </div>

      {message.cards?.length ? (
        <div className="cards">
          {message.cards.map((card) => (
            <ResponseCard key={card.id} card={card} onAction={onCardAction} isBusy={isBusy} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
