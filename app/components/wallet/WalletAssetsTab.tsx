'use client';

import type { ImportedWalletToken } from '@/lib/wallet-assets';
import { WalletTokenTools } from '../WalletTokenTools';
import type { LocalWallet } from '@/lib/keystore';
import type { Hex } from 'viem';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';

interface WalletAssetsTabProps {
  wallet: LocalWallet;
  username: string;
  chainId: number;
  chainLabel: string;
  stableBalances: Record<string, number>;
  profileToken?: ProfileTokenSummary | null;
  unlockedKey: Hex | null;
  onUnlockKey: (privateKey: Hex) => void;
  onTokensChange: (tokens: ImportedWalletToken[]) => void;
  notify?: (message: string) => void;
}

export function WalletAssetsTab({ wallet, username, chainId, chainLabel, stableBalances, profileToken, unlockedKey, onUnlockKey, onTokensChange, notify }: WalletAssetsTabProps) {
  const heldStables = (['USDT', 'USDC', 'USDm', 'cUSD'] as const).filter((sym) => (stableBalances[sym] ?? 0) > 0);
  const profileBalance = profileToken ? Number(profileToken.balance) / 10 ** profileToken.decimals : 0;
  return (
    <>
      <section className="wallet-token-section" aria-labelledby="wallet-assets-title">
        <div className="wallet-section-heading"><h3 id="wallet-assets-title">Your assets</h3><span>On {chainLabel}</span></div>
        {(heldStables.length > 0 || (profileToken && profileBalance > 0)) ? (
          <div className="wallet-token-list">
            {heldStables.map((sym) => (
              <div className="wallet-token-row" key={sym}>
                <span className={`wallet-token-mark wallet-token-${sym.toLowerCase()}`}>{sym.slice(0, 1)}</span>
                <span className="wallet-token-name"><strong>{sym}</strong><small>{sym === 'cUSD' || sym === 'USDm' ? 'Celo Dollar' : sym === 'USDT' ? 'Tether USD' : 'USD Coin'}</small></span>
                <strong className="wallet-token-balance">{stableBalances[sym].toFixed(sym === 'cUSD' ? 4 : 2)}</strong>
              </div>
            ))}
            {profileToken && profileBalance > 0 && (
              <div className="wallet-token-row" key={profileToken.address}>
                <span className="wallet-token-mark wallet-token-profile">{profileToken.symbol.slice(0, 1)}</span>
                <span className="wallet-token-name"><strong>{profileToken.symbol}</strong><small>{profileToken.name} · Profile token</small></span>
                <strong className="wallet-token-balance">{profileBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
              </div>
            )}
          </div>
        ) : (
          <p className="you-note">No balances yet. Receive funds to this wallet to see them here.</p>
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
