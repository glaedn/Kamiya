import type { KamiyaAuthContext, QuestContext } from "../../shared/types";
import { CerbanimoClient } from "./cerbanimoClient";

export async function loadQuestContext(auth: KamiyaAuthContext, projectId: string | number): Promise<QuestContext> {
  const result = await new CerbanimoClient(auth).getQuestContext(projectId);
  if (!result.ok || !result.data) {
    throw new Error(result.error ?? "Cerbanimo did not return quest context.");
  }
  return result.data;
}
