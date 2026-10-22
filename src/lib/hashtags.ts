/** Unique tags written as #name, lowercased, at most eight. */
export function parseHashtags(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/#([a-z0-9_]{2,32})/gi)) {
    found.add((match[1] ?? '').toLowerCase());
  }
  return [...found].slice(0, 8);
}
