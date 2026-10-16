'use client';

import { ArrowLeftRight, Check, Copy, Gift, Send, ShieldCheck, Sparkles, Coins, Wallet } from 'lucide-react';
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

// The four primary "quick actions" surfaced as big game buttons in the Vault.
const PRIMARY_ACTIONS: { id: WalletTabId; label: string; icon: typeof Send }[] = [
  { id: 'send', label: 'Send', icon: Send },
  { id: 'tip', label: 'Tip', icon: Sparkles },
  { id: 'drop', label: 'Create Drop', icon: Gift },
  { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
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
  const secondary = WALLET_TABS.filter((t) => !PRIMARY_ACTIONS.some((p) => p.id === t.id));

  return (
    <section className="vault-hero">
      <div className="vault-identity">
        <span className="wallet-network"><i /> {chainLabel}</span>
        <span className="vault-identity-text">
          <strong>{name || 'My wallet'}</strong>
          <span>{pinProtected ? 'PIN protected' : 'Passphrase protected'}</span>
        </span>
        <button className="wallet-address-copy" onClick={onCopy} aria-label={copied ? 'Wallet address copied' : 'Copy this wallet address'}>
          <span>{address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '…'}</span>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="vault-balance">
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

      <div className="vault-actions" aria-label="Wallet actions">
        {PRIMARY_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className={`vault-action${tab === a.id ? ' is-active' : ''}`} onClick={() => onTab(a.id)}>
              <Icon size={20} />
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="wallet-tabs vault-more" aria-label="More wallet sections">
        {secondary.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => onTab(t.id)}>
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
