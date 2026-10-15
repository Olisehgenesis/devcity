'use client';

import { Check, Copy, ShieldCheck } from 'lucide-react';

export type WalletTabId = 'assets' | 'send' | 'tip' | 'drop' | 'token' | 'trade' | 'security';

export const WALLET_TABS: { id: WalletTabId; label: string }[] = [
  { id: 'assets', label: 'Assets' },
  { id: 'send', label: 'Send' },
  { id: 'tip', label: 'Tip' },
  { id: 'drop', label: 'Create Drop' },
  { id: 'token', label: 'Token' },
  { id: 'trade', label: 'Trade' },
  { id: 'security', label: 'Security' },
];

interface WalletOverviewProps {
  chainLabel: string;
  chainId: number;
  name?: string;
  address?: string;
  pinProtected?: boolean;
  celoBalance: string;
  copied: boolean;
  onCopy: () => void;
  tab: WalletTabId;
  onTab: (tab: WalletTabId) => void;
}

export function WalletOverview({ chainLabel, chainId, name, address, pinProtected, celoBalance, copied, onCopy, tab, onTab }: WalletOverviewProps) {
  return (
    <section className="wallet-overview">
      <div className="wallet-overview-topline">
        <span className="wallet-network"><i /> {chainLabel}</span>
        <span className="wallet-security-status"><ShieldCheck size={13} /> {pinProtected ? 'PIN protected' : 'Passphrase protected'}</span>
      </div>
      <div className="wallet-owner">{name || 'My wallet'}</div>
      <button className="wallet-address-copy" onClick={onCopy} aria-label={copied ? 'Wallet address copied' : 'Copy this wallet address'}>
        <span>{address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '…'}</span>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <small>{copied ? 'Copied' : 'Copy address'}</small>
      </button>
      <div className="wallet-main-balance">
        <span>CELO balance</span>
        <strong>{celoBalance} <small>CELO</small></strong>
      </div>
      <nav className="wallet-tabs" aria-label="Wallet sections">
        {WALLET_TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </section>
  );
}
