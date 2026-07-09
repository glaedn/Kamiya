import type {
  ActionPreview,
  ChronicleResponse,
  CallingResponse,
  InviteCreateResponse,
  InvitePreviewResponse,
  LaunchPreviewResponse,
  NarrativePreferences,
  NarrativeSettingsResponse,
  PartyAssemblyContext,
  QuestContext,
  QuestProfileResponse,
  ResponseCard
} from "../../shared/types";

export function questScrollCard(context: QuestContext): ResponseCard {
  const profile = context.questProfile;
  const projectId = String(context.project?.id ?? profile?.projectId ?? "");
  return {
    id: `quest-scroll-${projectId || crypto.randomUUID()}`,
    kind: "quest_scroll",
    title: profile?.title ?? String(context.project?.name ?? "Quest scroll"),
    subtitle: profile?.genre ?? "Quest profile",
    body: profile?.premise ?? String(context.project?.description ?? ""),
    metadata: {
      projectId,
      outcome: profile?.desiredOutcome ?? "",
      tone: profile?.tone ?? "",
      stakes: profile?.stakes ?? "",
      themes: profile?.keyThemes ?? []
    },
    actions: [
      { id: "show-party", label: "Party", style: "secondary" as const, command: `/party ${projectId}` },
      { id: "show-chronicle", label: "Chronicle", style: "secondary" as const, command: `/chronicle ${projectId}` },
      ...(context.allowedActions?.launchQuest ? [{ id: "launch-quest", label: "Launch", style: "primary" as const, command: `/launch quest ${projectId}` }] : [])
    ].filter((action) => action.command && !action.command.endsWith(" "))
  };
}

export function questPortalCard(response: QuestProfileResponse): ResponseCard {
  const profile = response.profile;
  return {
    id: `quest-portal-${profile?.projectId ?? crypto.randomUUID()}`,
    kind: "quest_portal",
    title: profile?.title ?? String(response.project?.name ?? "Quest portal"),
    subtitle: profile?.status ?? "active",
    body: profile?.openingScene ?? profile?.premise,
    metadata: {
      projectId: String(response.project?.id ?? profile?.projectId ?? ""),
      genre: profile?.genre ?? "",
      audience: profile?.audience ?? ""
    }
  };
}

export function partyAssemblyCard(context: PartyAssemblyContext): ResponseCard {
  const projectId = String(context.project?.id ?? context.settings?.projectId ?? "");
  const members = context.members ?? [];
  const target = context.settings?.targetPartySize ?? 3;
  return {
    id: `party-${projectId || crypto.randomUUID()}`,
    kind: "party_assembly",
    title: "Party assembly",
    subtitle: `${members.length}/${target} companions`,
    body: context.shortage
      ? "The party is below the target size. Invite links are visible only to authorized project managers."
      : "The party has enough companions for the current target.",
    metadata: {
      projectId,
      minPartySize: context.settings?.minPartySize ?? 1,
      maxPartySize: context.settings?.maxPartySize ?? 7,
      openRecruitment: context.settings?.openRecruitment ? "yes" : "no",
      activeInvites: (context.invites ?? []).filter((invite) => invite.status === "active").length
    },
    items: members.map((member) => ({
      id: String(member.userId),
      title: member.username ?? `User ${member.userId}`,
      subtitle: member.calling?.title ?? "Party Member",
      status: member.calling?.roleArchetype ?? "party_member",
      metadata: {
        creator: member.isProjectCreator ? "yes" : "no",
        source: member.calling?.source ?? ""
      }
    })),
    actions: [
      ...(context.allowedActions?.createInvite ? [{ id: "create-invite", label: "Create invite", style: "primary" as const, command: `/party invite ${projectId}` }] : []),
      ...(context.allowedActions?.updateCalling ? [{ id: "update-calling", label: "Calling", style: "secondary" as const, command: `/calling ${projectId}` }] : [])
    ]
  };
}

export function characterCallingCard(response: CallingResponse): ResponseCard {
  const projectId = String(response.project?.id ?? response.calling?.projectId ?? "");
  return {
    id: `calling-${projectId || crypto.randomUUID()}`,
    kind: "character_calling",
    title: response.calling?.callingTitle ?? "Character calling",
    subtitle: response.calling?.roleArchetype ?? "party_member",
    body: response.calling?.contributionSummary ?? "No calling has been written yet.",
    metadata: {
      projectId,
      status: response.calling?.status ?? "not started",
      source: response.calling?.source ?? ""
    },
    actions: response.allowedActions?.updateCalling
      ? [{ id: "edit-calling", label: "Update calling", style: "secondary", command: `/calling ${projectId} title=Party Member` }]
      : undefined
  };
}

export function questOpeningSceneCard(response: LaunchPreviewResponse): ResponseCard {
  const actionId = response.action?.action_uuid ?? (response.action?.id ? String(response.action.id) : undefined);
  return {
    id: `opening-${actionId ?? crypto.randomUUID()}`,
    kind: "quest_opening_scene",
    title: response.canLaunch ? "Quest opening scene" : "Quest launch blocked",
    subtitle: response.canLaunch ? "Ready for confirmation" : "Needs attention",
    body: response.openingScene ?? response.missing?.[0]?.message ?? "Cerbanimo returned a launch preview.",
    metadata: {
      actionId: actionId ?? "",
      firstEncounters: response.firstEncounters?.length ?? 0,
      missing: response.missing?.map((item) => item.field) ?? []
    },
    items: response.firstEncounters?.map((task) => ({
      id: String(task.id),
      title: String(task.name ?? task.title ?? "Encounter"),
      subtitle: String(task.description ?? ""),
      status: String(task.status ?? "active")
    })),
    actions: response.canLaunch && actionId
      ? [{ id: "confirm", label: "Confirm launch", style: "primary", actionId }]
      : undefined
  };
}

export function chronicleCard(response: ChronicleResponse): ResponseCard {
  return {
    id: `chronicle-${response.project?.id ?? crypto.randomUUID()}`,
    kind: "chronicle",
    title: "Quest chronicle",
    subtitle: `${response.events.length} event${response.events.length === 1 ? "" : "s"}`,
    items: response.events.map((event) => ({
      id: String(event.uuid ?? event.id),
      title: event.title,
      subtitle: event.body ?? event.type,
      status: event.visibility ?? "party",
      metadata: {
        type: event.type,
        createdAt: event.createdAt ?? ""
      }
    }))
  };
}

export function narrativeSettingsCard(preferences: NarrativePreferences, response?: NarrativeSettingsResponse): ResponseCard {
  return {
    id: `narrative-settings-${response?.settings.projectId ?? "user"}`,
    kind: "narrative_settings",
    title: "Narrative settings",
    subtitle: preferences.presentationMode === "plain" ? "Plain mode" : "Game Master mode",
    metadata: {
      presentationMode: preferences.presentationMode,
      narrativeIntensity: preferences.narrativeIntensity,
      statDisplayMode: preferences.statDisplayMode,
      preferredGenres: preferences.preferredGenres,
      avoidThemes: preferences.avoidThemes,
      projectMode: response?.settings.presentationMode ?? ""
    },
    actions: [
      { id: "gm-on", label: "GM on", style: "secondary", command: "/game-master on" },
      { id: "gm-off", label: "GM off", style: "secondary", command: "/game-master off" },
      { id: "narrative-standard", label: "Standard", style: "primary", command: "/narrative standard" }
    ]
  };
}

export function inviteCreatedCard(response: InviteCreateResponse): ResponseCard {
  return {
    id: `invite-${response.invite.uuid ?? response.invite.id}`,
    kind: "party_assembly",
    title: "Party invite created",
    subtitle: response.invite.status,
    body: response.warning ?? "Share this token only with the intended collaborator.",
    metadata: {
      projectId: String(response.invite.projectId ?? ""),
      maxUses: response.invite.maxUses ?? 1,
      expiresAt: response.invite.expiresAt ?? "",
      inviteUrl: response.inviteUrl ?? "",
      token: response.token ?? ""
    }
  };
}

export function invitePreviewCard(response: InvitePreviewResponse): ResponseCard {
  return {
    id: `invite-preview-${response.invite.uuid ?? response.invite.id}`,
    kind: "quest_preview",
    title: `Invite to ${String(response.project?.name ?? "project")}`,
    subtitle: response.status,
    body: response.unavailableReason ? `This invite cannot be redeemed: ${response.unavailableReason}.` : "This invite can add you to the project party.",
    metadata: {
      projectId: String(response.project?.id ?? response.invite.projectId ?? ""),
      uses: `${response.invite.useCount ?? 0}/${response.invite.maxUses ?? 1}`,
      expiresAt: response.invite.expiresAt ?? ""
    }
  };
}

export function gameMasterActionPreview(action: NonNullable<LaunchPreviewResponse["action"]>, title: string, summary: string): ActionPreview {
  return {
    id: crypto.randomUUID(),
    kind: "game_master",
    title,
    summary,
    risk: "low",
    destructive: false,
    payload: {},
    requiredPermissions: ["projects:write"],
    createdAt: new Date().toISOString(),
    cerbanimoActionId: String(action.id),
    cerbanimoActionUuid: action.action_uuid ?? undefined,
    functionName: String(action.intent_json?.functionName ?? action.intent_json?.function ?? action.intent_json?.type ?? "projects.launch_quest")
  };
}
