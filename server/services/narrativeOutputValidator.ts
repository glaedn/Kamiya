const forbiddenClaims = [
  /\b(marked|set)\s+.*\bcomplete(d)?\b/i,
  /\bawarded?\b.*\b(xp|tokens?|rewards?)\b/i,
  /\bdependency\b.*\bactivated\b/i,
  /\bstory\b.*\bpublished\b/i,
  /\braw evidence\b/i,
  /\bblob key\b/i
];

export function validateNarrativeOutput(text: string): { ok: boolean; flags: string[]; safeText: string } {
  const flags = forbiddenClaims
    .map((pattern) => pattern.test(text) ? pattern.source : undefined)
    .filter((value): value is string => Boolean(value));

  if (!flags.length) return { ok: true, flags, safeText: text };

  return {
    ok: false,
    flags,
    safeText: [
      "Cerbanimo returned the quest state, but I am withholding speculative completion or reward language.",
      "The authoritative project, task, review, and settlement state is shown in the cards below."
    ].join(" ")
  };
}

export function enforcePlainPrefix(text: string): string {
  return text.startsWith("Out of character:") ? text : `Out of character: ${text}`;
}
