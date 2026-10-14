export function normalizeUsername(value: string): string | null {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(username) ? username : null;
}
