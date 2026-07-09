export type PartyCommand =
  | { kind: "show_party"; projectId: string }
  | { kind: "create_invite"; projectId: string }
  | { kind: "preview_invite"; token: string }
  | { kind: "redeem_invite"; token: string }
  | { kind: "show_calling"; projectId: string }
  | { kind: "update_calling"; projectId: string; input: Record<string, unknown> };

export function parsePartyCommand(message: string): PartyCommand | undefined {
  const trimmed = message.trim();
  const party = trimmed.match(/^\/party\s+(\S+)$/i) ?? trimmed.match(/^show party\s+(\S+)$/i);
  if (party?.[1]) return { kind: "show_party", projectId: party[1] };

  const invite = trimmed.match(/^\/party\s+invite\s+(\S+)$/i) ?? trimmed.match(/^create party invite\s+(\S+)$/i);
  if (invite?.[1]) return { kind: "create_invite", projectId: invite[1] };

  const preview = trimmed.match(/^\/invite\s+preview\s+(\S+)$/i) ?? trimmed.match(/^preview invite\s+(\S+)$/i);
  if (preview?.[1]) return { kind: "preview_invite", token: preview[1] };

  const redeem = trimmed.match(/^\/redeem\s+invite\s+(\S+)$/i) ?? trimmed.match(/^redeem invite\s+(\S+)$/i);
  if (redeem?.[1]) return { kind: "redeem_invite", token: redeem[1] };

  const calling = trimmed.match(/^\/calling\s+(\S+)$/i);
  if (calling?.[1]) return { kind: "show_calling", projectId: calling[1] };

  const updateCalling = trimmed.match(/^\/calling\s+(\S+)\s+(.+)$/i);
  if (updateCalling?.[1]) {
    return {
      kind: "update_calling",
      projectId: updateCalling[1],
      input: parseKeyValueInputs(updateCalling[2] ?? "")
    };
  }

  return undefined;
}

function parseKeyValueInputs(input: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const match of input.matchAll(/(\w+)=("[^"]+"|'[^']+'|\S+)/g)) {
    const key = match[1];
    const raw = match[2] ?? "";
    values[key] = raw.replace(/^['"]|['"]$/g, "");
  }
  if (!values.callingTitle && input.trim() && !input.includes("=")) values.callingTitle = input.trim();
  return values;
}
