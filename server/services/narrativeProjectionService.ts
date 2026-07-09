import type { NarrativePreferences, QuestContext } from "../../shared/types";
import { questBibleSummary } from "./questBibleService";
import { enforcePlainPrefix, validateNarrativeOutput } from "./narrativeOutputValidator";

export function projectQuestNarration(context: QuestContext, preferences?: Partial<NarrativePreferences>, plainOverride = false): string {
  const profile = context.questProfile;
  const projectName = String(context.project?.name ?? profile?.title ?? "this quest");
  const activeTasks = context.tasks?.filter((task) => String(task.status ?? "").includes("active")) ?? [];
  const partySize = context.party?.members?.length ?? 0;
  const intensity = preferences?.narrativeIntensity ?? "standard";
  const plain = plainOverride || preferences?.presentationMode === "plain";

  if (plain) {
    return enforcePlainPrefix([
      `${projectName} has ${context.tasks?.length ?? 0} known task${(context.tasks?.length ?? 0) === 1 ? "" : "s"}, ${activeTasks.length} active task${activeTasks.length === 1 ? "" : "s"}, and ${partySize} party member${partySize === 1 ? "" : "s"}.`,
      "No completion, reward, dependency, or story side effects are implied by this summary."
    ].join(" "));
  }

  const opening = intensity === "light"
    ? `${projectName} is ready on the quest board.`
    : intensity === "immersive"
      ? `The quest ledger opens with ${projectName}: ${profile?.premise ?? context.project?.description ?? "the party's next undertaking"}.`
      : `The quest board is focused on ${projectName}.`;

  const text = [
    opening,
    activeTasks.length
      ? `${activeTasks.length} encounter${activeTasks.length === 1 ? "" : "s"} can begin because Cerbanimo says their dependencies are clear.`
      : "Cerbanimo does not report any active encounters yet.",
    partySize
      ? `${partySize} companion${partySize === 1 ? "" : "s"} are recorded in the party.`
      : "The party roster is empty or not visible to this actor.",
    "Completion settlement, rewards, dependency activation, and story publication remain outside this step."
  ].join(" ");

  return validateNarrativeOutput(text).safeText;
}

export function questContextPlainSummary(context: QuestContext): string {
  return enforcePlainPrefix(questBibleSummary(context));
}
