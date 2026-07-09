import type { NarrativeIntensity, NarrativePreferences, PresentationMode, StatDisplayMode } from "../../shared/types";

export type GameMasterModeCommand =
  | { kind: "set_presentation"; presentationMode: PresentationMode }
  | { kind: "set_intensity"; narrativeIntensity: NarrativeIntensity }
  | { kind: "set_genre"; genre: string }
  | { kind: "avoid_theme"; theme: string }
  | { kind: "set_stats"; statDisplayMode: StatDisplayMode }
  | { kind: "plain_override"; strippedMessage: string };

const plainPrefixes = ["Game Master,", "Game Master:", "/plain"];

export function parseGameMasterModeCommand(message: string): GameMasterModeCommand | undefined {
  const trimmed = message.trim();
  for (const prefix of plainPrefixes) {
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return {
        kind: "plain_override",
        strippedMessage: trimmed.slice(prefix.length).trim()
      };
    }
  }

  const gameMaster = trimmed.match(/^\/game-master\s+(on|off)$/i);
  if (gameMaster?.[1]) {
    return {
      kind: "set_presentation",
      presentationMode: gameMaster[1].toLowerCase() === "on" ? "game_master" : "plain"
    };
  }

  const narrative = trimmed.match(/^\/narrative\s+(light|standard|immersive)$/i);
  if (narrative?.[1]) {
    return {
      kind: "set_intensity",
      narrativeIntensity: narrative[1].toLowerCase() as NarrativeIntensity
    };
  }

  const genre = trimmed.match(/^\/genre\s+(.+)$/i);
  if (genre?.[1]?.trim()) return { kind: "set_genre", genre: genre[1].trim() };

  const avoidTheme = trimmed.match(/^\/avoid-theme\s+(.+)$/i);
  if (avoidTheme?.[1]?.trim()) return { kind: "avoid_theme", theme: avoidTheme[1].trim() };

  const stats = trimmed.match(/^\/stats\s+(narrative|numeric|both)$/i);
  if (stats?.[1]) {
    return {
      kind: "set_stats",
      statDisplayMode: stats[1].toLowerCase() as StatDisplayMode
    };
  }

  return undefined;
}

export function applyPreferenceCommand(
  command: Exclude<GameMasterModeCommand, { kind: "plain_override" }>,
  preferences?: Partial<NarrativePreferences>
): Record<string, unknown> {
  if (command.kind === "set_presentation") return { presentationMode: command.presentationMode };
  if (command.kind === "set_intensity") return { narrativeIntensity: command.narrativeIntensity };
  if (command.kind === "set_genre") return { preferredGenres: [command.genre] };
  if (command.kind === "avoid_theme") {
    const existing = Array.isArray(preferences?.avoidThemes) ? preferences.avoidThemes : [];
    return { avoidThemes: [...new Set([...existing, command.theme])] };
  }
  return { statDisplayMode: command.statDisplayMode };
}

export function gameMasterPreferenceCopy(preferences: NarrativePreferences): string {
  if (preferences.presentationMode === "plain") {
    return "Out of character: Game Master narration is off. I will keep responses direct until you turn it back on with `/game-master on`.";
  }
  return `Game Master mode is active at ${preferences.narrativeIntensity} intensity with ${preferences.statDisplayMode} stats.`;
}

export function oneTurnPlainCopy(message: string): string {
  const subject = message.trim() ? ` I will answer this turn directly about: ${message.trim()}` : "";
  return `Out of character:${subject || " I will keep this turn direct."}`;
}
