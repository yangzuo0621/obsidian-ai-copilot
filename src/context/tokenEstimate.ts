const AVERAGE_CHARS_PER_TOKEN = 4;

export function estimateTokens(content: string): number {
  const normalizedLength = content.replace(/\s+/g, " ").trim().length;
  return Math.max(1, Math.ceil(normalizedLength / AVERAGE_CHARS_PER_TOKEN));
}

export function truncateToTokenBudget(content: string, tokenBudget: number): string {
  if (estimateTokens(content) <= tokenBudget) {
    return content;
  }

  const maxChars = Math.max(0, tokenBudget * AVERAGE_CHARS_PER_TOKEN);
  const truncated = content.slice(0, maxChars).trimEnd();
  return `${truncated}\n\n[Context truncated to fit the token budget.]`;
}
