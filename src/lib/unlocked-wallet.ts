import type { Hex } from 'viem';

let unlockedWallet: { address: string; privateKey: Hex } | null = null;

export function getUnlockedPrivateKey(address: string): Hex | null {
  return unlockedWallet?.address.toLowerCase() === address.toLowerCase()
    ? unlockedWallet.privateKey
    : null;
}

export function rememberUnlockedWallet(address: string, privateKey: Hex): void {
  unlockedWallet = { address: address.toLowerCase(), privateKey };
}

export function clearUnlockedWallet(address?: string): void {
  if (!address || unlockedWallet?.address === address.toLowerCase()) unlockedWallet = null;
}
