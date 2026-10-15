'use client';

import type { ImportedWalletToken } from '@/lib/wallet-assets';
import { WalletTokenTools } from '../WalletTokenTools';
import type { LocalWallet } from '@/lib/keystore';
import type { Hex } from 'viem';

interface WalletAssetsTabProps {
  wallet: LocalWallet;
  username: string;
  chainId: number;
  chainLabel: string;
  stableBalances: Record<string, number>;
  unlockedKey: Hex | null;
  onUnlockKey: (privateKey: Hex) => void;
  onTokensChange: (tokens: ImportedWalletToken[]) => void;
  notify?: (message: string) => void;
}

export function WalletAssetsTab({ wallet, username, chainId, chainLabel, stableBalances, unlockedKey, onUnlockKey, onTokensChange, notify }: WalletAssetsTabProps) {
  const heldStables = (['USDT', 'USDC', 'cUSD'] as const).filter((sym) => (stableBalances[sym] ?? 0) > 0);
  return (
    <>
      <section className="wallet-token-section" aria-labelledby="wallet-assets-title">
        <div className="wallet-section-heading"><h3 id="wallet-assets-title">Your assets</h3><span>On {chainLabel}</span></div>
        {heldStables.length > 0 ? (
          <div className="wallet-token-list">
            {heldStables.map((sym) => (
              <div className="wallet-token-row" key={sym}>
                <span className={`wallet-token-mark wallet-token-${sym.toLowerCase()}`}>{sym.slice(0, 1)}</span>
                <span className="wallet-token-name"><strong>{sym}</strong><small>{sym === 'cUSD' ? 'Celo Dollar' : sym === 'USDT' ? 'Tether USD' : 'USD Coin'}</small></span>
                <strong className="wallet-token-balance">{stableBalances[sym].toFixed(sym === 'cUSD' ? 4 : 2)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="you-note">No stablecoin balances yet. Receive funds to this wallet to see them here.</p>
        )}
      </section>

      {wallet && (
        <WalletTokenTools
          wallet={wallet}
          username={username}
          assetChainId={chainId}
          assetChainLabel={chainLabel}
          unlockedKey={unlockedKey}
          onUnlockKey={onUnlockKey}
          onTokensChange={onTokensChange}
          notify={notify}
        />
      )}
    </>
  );
}
