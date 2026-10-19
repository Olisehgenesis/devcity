'use client';

import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Gift, History, Power, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";

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
  { id: 'send', label: 'Send', icon: ArrowUpRight },
  { id: 'receive', label: 'Receive', icon: ArrowDownToLine },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'drop', label: 'Drop', icon: Gift },
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
          <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={onActivity} aria-label="Activity">
            <History size={16} />
          </Button>
          <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={onSettings} aria-label="Wallet settings">
            <Settings size={16} />
          </Button>
          <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={onSignOut} aria-label="Sign out">
            <Power size={16} />
          </Button>
        </div>
      </div>

      <div className="vault-balance">
        <span>Your balance</span>
        <strong>{balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : (usdBalance ?? celoBalance)}</strong>
        <em>{balanceLoading ? <span className="balance-skeleton" /> : usdBalance ? `${celoBalance} CELO` : 'CELO'}</em>
      </div>

      <div className="vault-actions" aria-label="Wallet actions">
        {ACTIONS.map((action) => (
          <Button key={action.id} type="button" className="h-auto flex-col whitespace-normal px-1" onClick={actions[action.id]}>
            <action.icon size={18} aria-hidden="true" />
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
