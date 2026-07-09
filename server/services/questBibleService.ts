import type { QuestContext } from "../../shared/types";

export function questBibleSummary(context: QuestContext): string {
  const projectName = String(context.project?.name ?? context.questProfile?.title ?? "this quest");
  const premise = context.questProfile?.premise ?? context.project?.description ?? "";
  const outcome = context.questProfile?.desiredOutcome ?? "";
  const partySize = context.party?.members?.length ?? 0;
  const taskCount = context.tasks?.length ?? 0;
  const activeTasks = context.tasks?.filter((task) => String(task.status ?? "").includes("active")).length ?? 0;

  return [
    `Quest: ${projectName}`,
    premise ? `Premise: ${premise}` : "",
    outcome ? `Outcome: ${outcome}` : "",
    `Party: ${partySize} member${partySize === 1 ? "" : "s"}`,
    `Tasks: ${taskCount} known, ${activeTasks} active`
  ].filter(Boolean).join("\n");
}

export function questFacts(context: QuestContext): Record<string, unknown> {
  return {
    projectId: context.project?.id,
    projectName: context.project?.name ?? context.questProfile?.title,
    profileStatus: context.questProfile?.status,
    partySize: context.party?.members?.length ?? 0,
    taskCount: context.tasks?.length ?? 0,
    activeTaskCount: context.tasks?.filter((task) => String(task.status ?? "").includes("active")).length ?? 0,
    acceptedPendingSettlement: context.review?.acceptedPendingSettlement ?? 0,
    chronicleEvents: context.chronicle?.length ?? 0,
    noRewardOrCompletionClaims: true
  };
}
