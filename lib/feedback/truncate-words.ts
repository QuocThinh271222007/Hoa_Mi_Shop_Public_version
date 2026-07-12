// Truncate to at most `maxWords` words (used for the short reviewer description).
// Kept in its own module (no other imports) so client components can use it
// without pulling in server-only code (e.g. next/headers via items.ts).
export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}
