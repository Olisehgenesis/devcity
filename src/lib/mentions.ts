import { normalizeUsername } from './usernames';

const MENTION = /(^|[^a-z0-9_])@([a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?)/gi;
const TYPING = /(^|[^a-z0-9_])@([a-z0-9-]{0,24})$/i;

/** Unique handles written as @name. Short or invalid names are skipped. */
export function parseMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    const handle = normalizeUsername(match[2] ?? '');
    if (handle) found.add(handle);
  }
  return [...found];
}

/** The handle fragment after the @ the person is still typing, or null. */
export function mentionBeingTyped(text: string, caret: number): string | null {
  const slice = text.slice(0, Math.max(0, caret));
  const match = slice.match(TYPING);
  if (!match) return null;
  return (match[2] ?? '').toLowerCase();
}

export function insertMention(text: string, caret: number, handle: string): { text: string; caret: number } {
  const slice = text.slice(0, Math.max(0, caret));
  const match = slice.match(TYPING);
  if (!match || match.index == null) {
    const next = `${text.slice(0, caret)}@${handle} ${text.slice(caret)}`;
    const nextCaret = caret + handle.length + 2;
    return { text: next, caret: nextCaret };
  }
  const start = match.index + match[1].length;
  const next = `${text.slice(0, start)}@${handle} ${text.slice(caret)}`;
  return { text: next, caret: start + handle.length + 2 };
}

/** A reply attaches to a top-level comment on the same post. */
export function canReplyTo(parent: { broadcastId: string; parentId: string | null } | null, broadcastId: string): boolean {
  return Boolean(parent && parent.broadcastId === broadcastId && parent.parentId == null);
}
