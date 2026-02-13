export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalCost?: number;
};

export function parseTokenUsage(json: string | null): TokenUsage | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      inputTokens: parsed.inputTokens ?? 0,
      outputTokens: parsed.outputTokens ?? 0,
      cacheReadTokens: parsed.cacheReadTokens,
      cacheWriteTokens: parsed.cacheWriteTokens,
      totalCost: parsed.totalCost,
    };
  } catch {
    return null;
  }
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
