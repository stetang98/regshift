export function formatTitle(raw: string): string {
  return raw.trim().slice(0, 80);
}

export const sumTokens = (counts: number[]): number => counts.reduce((a, b) => a + b, 0);
