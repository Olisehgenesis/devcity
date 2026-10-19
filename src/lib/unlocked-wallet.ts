import type { Hex } from 'viem';

const SESSION_KEY = 'devcity-wallet-session';

let unlockedWallet: { address: string; privateKey: Hex } | null = null;

function readSession(): { address: string; privateKey: Hex } | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { address?: string; privateKey?: string };
    if (!parsed.address || !/^0x[a-fA-F0-9]{64}$/.test(parsed.privateKey ?? '')) return null;
    return { address: parsed.address.toLowerCase(), privateKey: parsed.privateKey as Hex };
  } catch {
    return null;
  }
}

function writeSession(value: { address: string; privateKey: Hex } | null) {
  if (typeof sessionStorage === 'undefined') return;
  if (!value) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

function publish() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('devcity-wallet-unlocked'));
}

export function getUnlockedWallet(): { address: string; privateKey: Hex } | null {
  if (!unlockedWallet) unlockedWallet = readSession();
  return unlockedWallet;
}

export function getUnlockedPrivateKey(address: string): Hex | null {
  const unlocked = getUnlockedWallet();
  return unlocked?.address.toLowerCase() === address.toLowerCase()
    ? unlocked.privateKey
    : null;
}

export function rememberUnlockedWallet(address: string, privateKey: Hex): void {
  unlockedWallet = { address: address.toLowerCase(), privateKey };
  writeSession(unlockedWallet);
  publish();
}

export function clearUnlockedWallet(address?: string): void {
  if (!address || unlockedWallet?.address === address.toLowerCase()) {
    unlockedWallet = null;
    writeSession(null);
    publish();
  }
}
