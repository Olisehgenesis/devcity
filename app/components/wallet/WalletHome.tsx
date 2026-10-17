'use client';

import type { ReactNode } from 'react';
import { formatUsd } from '../../hooks/useUsdPrices';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';
import type { HeldTokenView } from './types';

type HoldingStatus = 'loading' | 'ready' | 'error';

interface WalletHomeProps {
  celoBalance: string;
  stableBalances: Record<string, number | null>;
  holdingStatus?: Partial<Record<'CELO' | 'USDT' | 'USDC' | 'cUSD', HoldingStatus>>;
  onRetryHolding?: (symbol: 'CELO' | 'USDT' | 'USDC' | 'cUSD') => void;
  usdPrices: Record<string, number>;
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

function usdFor(prices: Record<string, number>, symbol: string, amount: number) {
  const price = prices[symbol];
  if (price == null || !Number.isFinite(amount)) return null;
  return amount * price;
}

export function WalletHome({ celoBalance, stableBalances, holdingStatus, onRetryHolding, usdPrices, profileToken, profileLoading, onOpenToken, onOpenProfile, children }: WalletHomeProps) {
  const celoStatus = holdingStatus?.CELO ?? 'ready';
  const celoAmount = celoStatus === 'ready' ? Number(celoBalance) : null;
  const celoUsd = celoAmount != null ? usdFor(usdPrices, 'CELO', celoAmount) : null;
  const heldStables = STABLES.filter((token) => {
    const status = holdingStatus?.[token.symbol] ?? 'ready';
    if (status !== 'ready') return true;
    return (stableBalances[token.symbol] ?? 0) > 0;
  });
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
          <span className="wallet-token-name">
            <strong>CELO</strong>
            <small>{celoStatus === 'loading' ? <span className="balance-skeleton" /> : celoStatus === 'error' ? 'Could not load' : celoUsd != null ? celoBalance : 'Celo'}</small>
          </span>
          <strong className="wallet-token-balance">
            {celoStatus === 'loading' ? <span className="balance-skeleton" /> : celoStatus === 'error' ? <button type="button" className="wallet-retry" onClick={(event) => { event.stopPropagation(); onRetryHolding?.('CELO'); }}>Retry</button> : celoUsd != null ? formatUsd(celoUsd) : celoBalance}
          </strong>
        </button>
        {heldStables.map((token) => {
          const status = holdingStatus?.[token.symbol] ?? 'ready';
          const amount = stableBalances[token.symbol];
          const usd = amount != null ? usdFor(usdPrices, token.symbol, amount) : null;
          const amountLabel = amount != null ? amount.toFixed(token.digits) : '';
          return (
            <button
              type="button"
              key={token.symbol}
              className="wallet-token-row"
              onClick={() => onOpenToken({
                kind: 'stable',
                symbol: token.symbol,
                name: token.name,
                balance: amountLabel,
                sendToken: token.symbol,
              })}
            >
              <span className={`wallet-token-mark wallet-token-${token.symbol.toLowerCase()}`}>{token.symbol.slice(0, 1)}</span>
              <span className="wallet-token-name">
                <strong>{token.symbol}</strong>
                <small>{status === 'loading' ? <span className="balance-skeleton" /> : status === 'error' ? 'Could not load' : usd != null ? amountLabel : token.name}</small>
              </span>
              <strong className="wallet-token-balance">
                {status === 'loading' ? <span className="balance-skeleton" /> : status === 'error' ? <button type="button" className="wallet-retry" onClick={(event) => { event.stopPropagation(); onRetryHolding?.(token.symbol); }}>Retry</button> : usd != null ? formatUsd(usd) : amountLabel}
              </strong>
            </button>
          );
        })}
        {profileToken && (
          <button type="button" className="wallet-token-row" onClick={onOpenProfile}>
            <span className="wallet-token-mark wallet-token-profile">{profileToken.symbol.slice(0, 1)}</span>
            <span className="wallet-token-name">
              <strong>{profileToken.symbol}</strong>
              <small>{profileToken.name}</small>
            </span>
            <strong className="wallet-token-balance">
              {profileLoading ? <span className="balance-skeleton" /> : profileBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
