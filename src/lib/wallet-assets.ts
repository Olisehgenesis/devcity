import { getAddress, isAddress, type Address } from 'viem';

export interface ImportedWalletToken {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
}

function storageKey(walletAddress: string, chainId: number) {
  return `devcity:wallet-tokens:${walletAddress.toLowerCase()}:${chainId}`;
}

export function getImportedWalletTokens(walletAddress: string, chainId: number): ImportedWalletToken[] {
  if (typeof window === 'undefined') return [];
  const serialized = window.localStorage.getItem(storageKey(walletAddress, chainId));
  if (!serialized) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new Error('Saved token list is invalid. Remove the damaged wallet token list from this device.');
  return parsed.filter((item): item is ImportedWalletToken => (
    typeof item === 'object'
    && item !== null
    && 'address' in item
    && typeof item.address === 'string'
    && isAddress(item.address)
    && 'name' in item
    && typeof item.name === 'string'
    && 'symbol' in item
    && typeof item.symbol === 'string'
    && 'decimals' in item
    && typeof item.decimals === 'number'
    && Number.isInteger(item.decimals)
    && item.decimals >= 0
    && item.decimals <= 255
    && 'chainId' in item
    && item.chainId === chainId
  )).map((item) => ({ ...item, address: getAddress(item.address) }));
}

export function saveImportedWalletToken(walletAddress: string, chainId: number, token: ImportedWalletToken) {
  const existing = getImportedWalletTokens(walletAddress, chainId);
  if (existing.some((item) => item.address.toLowerCase() === token.address.toLowerCase())) {
    throw new Error('This token is already in your wallet list.');
  }
  window.localStorage.setItem(storageKey(walletAddress, chainId), JSON.stringify([...existing, token]));
}

export function removeImportedWalletToken(walletAddress: string, chainId: number, address: Address) {
  const remaining = getImportedWalletTokens(walletAddress, chainId).filter(
    (item) => item.address.toLowerCase() !== address.toLowerCase(),
  );
  window.localStorage.setItem(storageKey(walletAddress, chainId), JSON.stringify(remaining));
}
