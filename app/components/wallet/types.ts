import type { Hex } from 'viem';
import type { ImportedWalletToken } from '@/lib/wallet-assets';

export interface WalletAccountContext {
  user: { id: string; name?: string | null; email?: string | null } | null;
  wallet: { address: string; pinProtected?: boolean } | null;
  unlockedKey: Hex | null;
  handle: string;
  handleTicker: string;
  chainId: number;
  chainLabel: string;
  copied: boolean;
}

export interface WalletNotify {
  onNotify?: (message: string) => void;
  onError?: (message: string) => void;
  onUnlockKey?: (privateKey: Hex) => void;
}

export interface TokenOption {
  symbol: string;
  name?: string;
  address?: string;
  decimals?: number;
}

export interface HeldTokenView {
  kind: 'celo' | 'stable' | 'imported';
  symbol: string;
  name: string;
  balance: string;
  contract?: string;
  /** Value for the send-token select: CELO, a fee symbol, or CUSTOM:0x… */
  sendToken: string;
}
