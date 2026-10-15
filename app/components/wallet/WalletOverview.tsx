'use client';

import { ArrowLeftRight, Check, Coins, Copy, Gift, Send, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';

export type WalletTabId = 'assets' | 'send' | 'tip' | 'drop' | 'token' | 'trade' | 'security';

export const WALLET_TABS: { id: WalletTabId; label: string; icon: typeof Wallet }[] = [
  { id: 'assets', label: 'Assets', icon: Wallet },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'tip', label: 'Tip', icon: Sparkles },
  { id: 'drop', label: 'Create Drop', icon: Gift },
  { id: 'token', label: 'Token', icon: Coins },
  { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

interface WalletOverviewProps {
  chainLabel: string;
  chainId: number;
  name?: string;
  address?: string;
  pinProtected?: boolean;
  celoBalance: string;
  profileToken?: ProfileTokenSummary | null;
  copied: boolean;
  onCopy: () => void;
  tab: WalletTabId;
  onTab: (tab: WalletTabId) => void;
}

export function WalletOverview({ chainLabel, chainId, name, address, pinProtected, celoBalance, profileToken, copied, onCopy, tab, onTab }: WalletOverviewProps) {
  const profileBalance = profileToken ? Number(profileToken.balance) / 10 ** profileToken.decimals : 0;
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
      {profileToken && profileBalance > 0 && (
        <div className="wallet-profile-token-balance">
          <span className="wallet-profile-token-mark">{profileToken.symbol.slice(0, 1)}</span>
          <span className="wallet-profile-token-copy">
            <strong>{profileBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} <small>{profileToken.symbol}</small></strong>
            <span>{profileToken.name}</span>
          </span>
        </div>
      )}
      <nav className="wallet-tabs" aria-label="Wallet sections">
        {WALLET_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => onTab(t.id)}>
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
