'use client';

import { isAddress } from 'viem';

export interface ResolvedUser {
  address: string;
  name: string;
}

/**
 * Resolve a recipient the user typed: a raw 0x wallet address, or a DEVCITY
 * username / handle (e.g. `oliseh`, `oliseh.devcity`, `oliseh.devcity.fun`).
 * Returns the wallet address + display name, or null if it can't be resolved.
 */
export async function resolveRecipient(input: string): Promise<ResolvedUser | null> {
  const value = input.trim();
  if (!value) return null;

  if (isAddress(value)) {
    return { address: value, name: `Wallet ${value.slice(0, 6)}…${value.slice(-4)}` };
  }

  const handleQuery = value
    .toLowerCase()
    .replace(/\.devcity\.fun$/i, '')
    .replace(/\.devcity$/i, '')
    .trim();

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(handleQuery)}&type=users&limit=5`);
    if (!res.ok) return null;
    const data = await res.json() as { users?: { username: string; name: string | null; walletAddress: string | null }[] };
    const users = data.users ?? [];
    const exact = users.find((u) => u.username.toLowerCase() === handleQuery)
      ?? users.find((u) => u.name && u.name.toLowerCase() === handleQuery)
      ?? users[0];
    if (!exact?.walletAddress) return null;
    return { address: exact.walletAddress, name: exact.name || exact.username };
  } catch {
    return null;
  }
}
