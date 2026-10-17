'use client';

import type { ReactNode } from 'react';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';
import type { HeldTokenView } from './types';

interface WalletHomeProps {
  celoBalance: string;
  stableBalances: Record<string, number>;
  profileToken?: ProfileTokenSummary | null;
  profileLoading?: boolean;
  onOpenToken: (token: HeldTokenView) => void;
  onOpenProfile: () => void;
  children: ReactNode;
}

const STABLES = [
  { symbol: 'USDT', name: 'Tether USD', digits: 2 },
  { symbol: 'USDC', name: 'USD Coin', digits: 2 },
  { symbol: 'cUSD', name: 'Celo Dollar', digits: 4 },
] as const;

export function WalletHome({ celoBalance, stableBalances, profileToken, profileLoading, onOpenToken, onOpenProfile, children }: WalletHomeProps) {
  const heldStables = STABLES.filter((token) => (stableBalances[token.symbol] ?? 0) > 0);
  const profileBalance = profileToken ? Number(profileToken.balance) / 10 ** profileToken.decimals : 0;

  return (
    <section className="wallet-token-section" aria-labelledby="wallet-tokens-title">
      <h3 id="wallet-tokens-title" className="wallet-holdings-label">Holdings</h3>
      <div className="wallet-token-list">
        <button
          type="button"
          className="wallet-token-row"
          onClick={() => onOpenToken({
            kind: 'celo',
            symbol: 'CELO',
            name: 'Celo',
            balance: `${celoBalance} CELO`,
            sendToken: 'CELO',
          })}
        >
          <span className="wallet-token-mark">C</span>
          <span className="wallet-token-name"><strong>CELO</strong><small>Celo</small></span>
          <strong className="wallet-token-balance">{celoBalance}</strong>
        </button>
        {heldStables.map((token) => (
          <button
            type="button"
            key={token.symbol}
            className="wallet-token-row"
            onClick={() => onOpenToken({
              kind: 'stable',
              symbol: token.symbol,
              name: token.name,
              balance: stableBalances[token.symbol].toFixed(token.digits),
              sendToken: token.symbol,
            })}
          >
            <span className={`wallet-token-mark wallet-token-${token.symbol.toLowerCase()}`}>{token.symbol.slice(0, 1)}</span>
            <span className="wallet-token-name"><strong>{token.symbol}</strong><small>{token.name}</small></span>
            <strong className="wallet-token-balance">{stableBalances[token.symbol].toFixed(token.digits)}</strong>
          </button>
        ))}
        {profileToken && (
          <button type="button" className="wallet-token-row" onClick={onOpenProfile}>
            <span className="wallet-token-mark wallet-token-profile">{profileToken.symbol.slice(0, 1)}</span>
            <span className="wallet-token-name">
              <strong>{profileToken.symbol}</strong>
              <small>{profileToken.name}</small>
            </span>
            <strong className="wallet-token-balance">
              {profileBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </strong>
          </button>
        )}
      </div>
      {children}
      {!profileToken && !profileLoading && (
        <button type="button" className="wallet-quiet-link" onClick={onOpenProfile}>Launch token</button>
      )}
    </section>
  );
}
