export function parseDeckId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // URL?
  try {
    const u = new URL(trimmed);
    const q = u.searchParams.get('deckID');
    if (q) return q;
    const m = u.pathname.match(/\/deckID\/([^/]+)/);
    if (m) return m[1];
  } catch {}
  // Otherwise treat as code
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}
