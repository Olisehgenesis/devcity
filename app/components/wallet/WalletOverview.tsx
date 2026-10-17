'use client';

import { History, Settings } from 'lucide-react';

interface WalletOverviewProps {
  chainLabel: string;
  name?: string;
  address?: string;
  celoBalance: string;
  usdBalance?: string | null;
  balanceLoading?: boolean;
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onDrop: () => void;
  onActivity: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

const ACTIONS = [
  { id: 'send', label: 'Send' },
  { id: 'receive', label: 'Receive' },
  { id: 'swap', label: 'Swap' },
  { id: 'drop', label: 'Drop' },
] as const;

export function WalletOverview({ chainLabel, name, address, celoBalance, usdBalance, balanceLoading, onSend, onReceive, onSwap, onDrop, onActivity, onSettings, onSignOut }: WalletOverviewProps) {
  const actions: Record<(typeof ACTIONS)[number]['id'], () => void> = {
    send: onSend,
    receive: onReceive,
    swap: onSwap,
    drop: onDrop,
  };
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  return (
    <section className="vault-hero">
      <div className="vault-identity">
        <span className="vault-identity-text">
          <strong>{name || 'Wallet'}</strong>
          <span>{chainLabel}{short ? ` · ${short}` : ''}</span>
        </span>
        <div className="vault-hero-tools">
          <button type="button" className="vault-icon-button" onClick={onActivity} aria-label="Activity">
            <History size={16} />
          </button>
          <button type="button" className="vault-icon-button" onClick={onSettings} aria-label="Wallet settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="vault-balance">
        <span>Your balance</span>
        <strong>{balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : (usdBalance ?? celoBalance)}</strong>
        <em>{balanceLoading ? <span className="balance-skeleton" /> : usdBalance ? `${celoBalance} CELO` : 'CELO'}</em>
      </div>

      <div className="vault-actions" aria-label="Wallet actions">
        {ACTIONS.map((action) => (
          <button key={action.id} type="button" className="vault-action" onClick={actions[action.id]}>
            {action.label}
          </button>
        ))}
      </div>
      <button type="button" className="you-disconnect vault-signout" onClick={onSignOut}>Sign out</button>
    </section>
  );
}
