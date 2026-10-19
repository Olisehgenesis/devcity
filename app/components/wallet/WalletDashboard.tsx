'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MoreItem {
  id: string;
  label: string;
  onClick: () => void;
}

interface WalletDashboardProps {
  usdBalance: string | null;
  balanceLoading: boolean;
  nativeBalance: string;
  nativeLoading: boolean;
  nativeError: boolean;
  onRetryNative?: () => void;
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  moreItems: MoreItem[];
  onAddToken?: () => void;
  onLaunchToken?: () => void;
  launchLabel?: string;
  summary: ReactNode;
  table: ReactNode;
  activity: ReactNode;
}

export function WalletDashboard({
  usdBalance,
  balanceLoading,
  nativeBalance,
  nativeLoading,
  nativeError,
  onRetryNative,
  onSend,
  onReceive,
  onSwap,
  moreItems,
  onAddToken,
  onLaunchToken,
  launchLabel = 'Launch token',
  summary,
  table,
  activity,
}: WalletDashboardProps) {
  const moreId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [moreOpen]);

  function seeTokens() {
    const target = document.getElementById('wallet-tokens');
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="wdash">
      <div className="wdash-top">
        <section className="wdash-card wdash-balance" aria-labelledby="wallet-balance-label">
          <div className="wdash-balance-figure">
            <p id="wallet-balance-label">Total balance</p>
            <strong>
              {balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : (usdBalance ?? 'Price unavailable')}
            </strong>
            <em>
              {nativeLoading ? <span className="balance-skeleton" /> : nativeError ? (
                <>
                  Could not load CELO
                  <button type="button" className="wallet-retry" onClick={onRetryNative}>Retry</button>
                </>
              ) : nativeBalance ? `${nativeBalance} CELO` : '—'}
            </em>
          </div>
          <div className="wdash-actions" aria-label="Wallet actions">
            <Button type="button" variant="outline" size="sm" onClick={onSend}>
              <ArrowUpRight aria-hidden="true" /> Send
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onReceive}>
              <ArrowDownToLine aria-hidden="true" /> Receive
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onSwap}>
              <ArrowLeftRight aria-hidden="true" /> Swap
            </Button>
            <div className="wdash-more" ref={moreRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-controls={moreId}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreHorizontal aria-hidden="true" /> More
              </Button>
              {moreOpen && (
                <div className="wshell-menu" id={moreId} role="menu">
                  {moreItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        item.onClick();
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="wdash-card wdash-holdings" aria-labelledby="wallet-holdings-title">
          <header>
            <h2 id="wallet-holdings-title">Your holdings</h2>
            <button type="button" onClick={seeTokens}>
              Tokens <ChevronRight size={16} aria-hidden="true" />
            </button>
          </header>
          {summary}
        </section>
      </div>

      <div className="wdash-bottom">
        <section className="wdash-card wdash-tokens" id="wallet-tokens" aria-label="Tokens">
          <header>
            <h2 className="wdash-tokens-desktop">Tokens</h2>
            <h2 className="wdash-tokens-mobile">Holdings</h2>
            {(onAddToken || onLaunchToken) && (
              <div className="wdash-token-actions">
                {onAddToken && <button type="button" onClick={onAddToken}>Add a token</button>}
                {onLaunchToken && <button type="button" onClick={onLaunchToken}>{launchLabel}</button>}
              </div>
            )}
          </header>
          <div className="wdash-table-head" aria-hidden="true">
            <span>Asset</span>
            <span>Balance</span>
            <span>Value</span>
          </div>
          {table}
        </section>
        <section className="wdash-card wdash-activity" aria-labelledby="wallet-recent-title">
          <header>
            <h2 id="wallet-recent-title">Recent activity</h2>
          </header>
          {activity}
        </section>
      </div>
    </div>
  );
}
