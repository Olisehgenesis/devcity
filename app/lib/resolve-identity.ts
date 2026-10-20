export type ResolvedIdentity = {
  address: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  joinedAt: string | null;
};

const cache = new Map<string, ResolvedIdentity>();

export async function resolveIdentity(address: string): Promise<ResolvedIdentity> {
  const key = address.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const response = await fetch(`/api/identity?address=${encodeURIComponent(key)}`);
  const body = await response.json() as ResolvedIdentity & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Could not resolve that person.');
  cache.set(key, body);
  return body;
}

export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
