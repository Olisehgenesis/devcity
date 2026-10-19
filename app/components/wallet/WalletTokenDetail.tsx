'use client';

import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeldTokenView } from './types';
import { TokenMark } from './TokenMark';

interface WalletTokenDetailProps {
  token: HeldTokenView;
  chainLabel: string;
  explorerBase?: string;
  balanceLoading?: boolean;
  usdLabel?: string | null;
  onSend: () => void;
  onReceive: () => void;
  onRemove?: () => void;
  activity?: ReactNode;
}

export function WalletTokenDetail({ token, chainLabel, explorerBase, balanceLoading, usdLabel, onSend, onReceive, onRemove, activity }: WalletTokenDetailProps) {
  const explorer = token.contract && explorerBase ? `${explorerBase}/address/${token.contract}` : null;

  return (
    <section className="wallet-token-detail wtoken" aria-labelledby="wallet-token-detail-title">
      <div className="wtoken-hero">
        <span className="wtoken-mark"><TokenMark symbol={token.symbol} /></span>
        <h3 id="wallet-token-detail-title">{token.symbol}</h3>
        <p>{balanceLoading ? 'Loading balance' : `${token.balance || '—'} ${token.symbol}`}</p>
      </div>
      <p className="wtoken-usd">
        {balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : (usdLabel ?? 'Price unavailable')}
      </p>
      <div className="wtoken-chart">
        <p>Chart unavailable</p>
      </div>
      <div className="wtoken-actions">
        <Button type="button" className="w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" onClick={onSend}>
          <ArrowUpRight size={16} /> Send
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onReceive}>
          <ArrowDownLeft size={16} /> Receive
        </Button>
      </div>
      <dl className="wtoken-balance">
        <div><dt>Your balance</dt><dd>{balanceLoading ? '…' : token.balance || '—'}</dd></div>
        <div><dt>Network</dt><dd>{chainLabel}</dd></div>
        {token.contract && <div><dt>Contract</dt><dd className="wtoken-contract">{token.contract}</dd></div>}
      </dl>
      {explorer && (
        <a className="wallet-token-explorer" href={explorer} target="_blank" rel="noreferrer">
          View on explorer <ExternalLink size={13} />
        </a>
      )}
      {activity}
      {onRemove && (
        <Button type="button" variant="outline" onClick={onRemove}>
          Remove {token.symbol} from this list
        </Button>
      )}
    </section>
  );
}
