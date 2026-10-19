'use client';

import type { ReactNode } from 'react';
import { formatUsd } from '../../hooks/useUsdPrices';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';
import type { HeldTokenView } from './types';
import { TokenMark } from './TokenMark';

type HoldingStatus = 'loading' | 'ready' | 'error';

interface WalletHomeProps {
  celoBalance: string;
  stableBalances: Record<string, number | null>;
  holdingStatus?: Partial<Record<'CELO' | 'USDT' | 'USDC' | 'USDm', HoldingStatus>>;
  onRetryHolding?: (symbol: 'CELO' | 'USDT' | 'USDC' | 'USDm') => void;
  usdPrices: Record<string, number>;
  profileToken?: ProfileTokenSummary | null;
  profileLoading?: boolean;
  onOpenToken: (token: HeldTokenView) => void;
  onOpenProfile: () => void;
  presentation?: 'summary' | 'table';
  children?: ReactNode;
}

const STABLES = [
  { symbol: 'USDT', name: 'Tether USD', digits: 2 },
  { symbol: 'USDC', name: 'USD Coin', digits: 2 },
  { symbol: 'USDm', name: 'Mento Dollar', digits: 4 },
] as const;

function usdFor(prices: Record<string, number>, symbol: string, amount: number) {
  const price = prices[symbol];
  if (price == null || !Number.isFinite(amount)) return null;
  return amount * price;
}

export function WalletHome({
  celoBalance,
  stableBalances,
  holdingStatus,
  onRetryHolding,
  usdPrices,
  profileToken,
  profileLoading,
  onOpenToken,
  onOpenProfile,
  presentation = 'table',
  children,
}: WalletHomeProps) {
  const celoStatus = holdingStatus?.CELO ?? 'ready';
  const celoAmount = celoStatus === 'ready' ? Number(celoBalance) : null;
  const celoUsd = celoAmount != null ? usdFor(usdPrices, 'CELO', celoAmount) : null;
  const heldStables = STABLES.filter((token) => {
    if (token.symbol === 'USDm') return true;
    const status = holdingStatus?.[token.symbol] ?? 'ready';
    if (status !== 'ready') return true;
    return (stableBalances[token.symbol] ?? 0) > 0;
  });
  const profileBalance = profileToken ? Number(profileToken.balance) / 10 ** profileToken.decimals : 0;
  const profileUsd = profileToken ? usdFor(usdPrices, profileToken.symbol, profileBalance) : null;

  return (
    <div className={`wh-list is-${presentation}`}>
      <HoldingRow
        symbol="CELO"
        name="Celo"
        status={celoStatus}
        amountLabel={celoStatus === 'ready' ? celoBalance : ''}
        usdLabel={celoUsd != null ? formatUsd(celoUsd) : null}
        onOpen={() => onOpenToken({
          kind: 'celo',
          symbol: 'CELO',
          name: 'Celo',
          balance: celoBalance,
          sendToken: 'CELO',
        })}
        onRetry={() => onRetryHolding?.('CELO')}
      />
      {heldStables.map((token) => {
        const status = holdingStatus?.[token.symbol] ?? 'ready';
        const amount = stableBalances[token.symbol];
        const usd = amount != null ? usdFor(usdPrices, token.symbol, amount) : null;
        const amountLabel = amount != null ? amount.toFixed(token.digits) : '';
        return (
          <HoldingRow
            key={token.symbol}
            symbol={token.symbol}
            name={token.name}
            status={status}
            amountLabel={amountLabel}
            usdLabel={usd != null ? formatUsd(usd) : null}
            onOpen={() => onOpenToken({
              kind: 'stable',
              symbol: token.symbol,
              name: token.name,
              balance: amountLabel,
              sendToken: token.symbol,
            })}
            onRetry={() => onRetryHolding?.(token.symbol)}
          />
        );
      })}
      {profileLoading && (
        <div className="wh-row" aria-busy="true">
          <span className="wh-mark" aria-hidden="true" />
          <span className="wh-copy"><strong>Profile token</strong><small>Loading balance</small></span>
          <span className="wh-usd"><span className="balance-skeleton" /></span>
        </div>
      )}
      {profileToken && (
        <HoldingRow
          symbol={profileToken.symbol}
          name={profileToken.name}
          icon={profileToken.tokenURI.startsWith('http') || profileToken.tokenURI.startsWith('data:') || profileToken.tokenURI.startsWith('/') ? profileToken.tokenURI : null}
          status="ready"
          amountLabel={profileBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          usdLabel={profileUsd != null ? formatUsd(profileUsd) : null}
          onOpen={onOpenProfile}
        />
      )}
      {presentation === 'table' && children}
    </div>
  );
}

function HoldingRow({
  symbol,
  name,
  icon,
  status,
  amountLabel,
  usdLabel,
  onOpen,
  onRetry,
}: {
  symbol: string;
  name: string;
  icon?: string | null;
  status: HoldingStatus;
  amountLabel: string;
  usdLabel: string | null;
  onOpen: () => void;
  onRetry?: () => void;
}) {
  const value = status === 'ready' ? (usdLabel ?? 'Price unavailable') : '';
  return (
    <div className="wh-row">
      <button type="button" className="wh-open" onClick={onOpen}>
        <TokenMark symbol={symbol} src={icon} />
        <span className="wh-copy">
          <strong>{symbol}</strong>
          <small className="wh-sub">{name}</small>
          <small className="wh-subamt">
            {status === 'loading' ? <span className="balance-skeleton" /> : status === 'error' ? 'Could not load' : amountLabel}
          </small>
        </span>
        <span className="wh-bal">
          {status === 'loading' ? <span className="balance-skeleton" /> : status === 'error' ? 'Unavailable' : amountLabel || '—'}
        </span>
        <span className="wh-usd">
          {status === 'loading' ? <span className="balance-skeleton" /> : status === 'error' ? '' : value}
        </span>
      </button>
      {status === 'error' && (
        <button type="button" className="wallet-retry" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
