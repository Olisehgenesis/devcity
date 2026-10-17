'use client';

import { ArrowDownLeft, ArrowLeftRight, Gift, History, Send, Settings } from 'lucide-react';

interface WalletOverviewProps {
  chainLabel: string;
  name?: string;
  address?: string;
  celoBalance: string;
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onDrop: () => void;
  onActivity: () => void;
  onSettings: () => void;
}

const ACTIONS = [
  { id: 'send', label: 'Send', icon: Send },
  { id: 'receive', label: 'Receive', icon: ArrowDownLeft },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'drop', label: 'Drop', icon: Gift },
] as const;

export function WalletOverview({ chainLabel, name, address, celoBalance, onSend, onReceive, onSwap, onDrop, onActivity, onSettings }: WalletOverviewProps) {
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
        <strong>{celoBalance}</strong>
        <em>CELO</em>
      </div>

      <div className="vault-actions" aria-label="Wallet actions">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.id} type="button" className="vault-action" onClick={actions[action.id]}>
              <span className="vault-action-orb"><Icon size={18} /></span>
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
