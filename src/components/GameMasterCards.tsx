import type { ResponseCard as ResponseCardType } from "../../shared/types";
import { ResponseCard } from "./ResponseCard";

interface GameMasterCardProps {
  card: ResponseCardType;
  onAction: Parameters<typeof ResponseCard>[0]["onAction"];
  isBusy?: boolean;
}

export function QuestScroll(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function QuestPortalCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function QuestPreviewCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function PartyAssemblyCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function CharacterCallingCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function QuestOpeningScene(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function EncounterCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function QuestLedgerCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function ChronicleCard(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function NarrativeSettingsPanel(props: GameMasterCardProps) {
  return <ResponseCard {...props} />;
}

export function PlainModeBanner({ message = "Out of character: Plain mode is active for this turn." }: { message?: string }) {
  return (
    <div className="plain-mode-banner" role="status">
      {message}
    </div>
  );
}
