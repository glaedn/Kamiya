import { Sparkles } from "lucide-react";

interface GameMasterOnboardingProps {
  enabled?: boolean;
  intensity?: string;
  stats?: string;
  onConfigure: () => void;
}

export function GameMasterOnboarding({ enabled = true, intensity = "standard", stats = "both", onConfigure }: GameMasterOnboardingProps) {
  return (
    <section className="gm-onboarding" aria-label="Game Master mode">
      <div>
        <Sparkles size={18} aria-hidden="true" />
        <h2>Game Master</h2>
      </div>
      <p>{enabled ? `${intensity} narration, ${stats} stats` : "Plain responses"}</p>
      <button className="secondary wide" type="button" onClick={onConfigure}>
        Settings
      </button>
    </section>
  );
}
