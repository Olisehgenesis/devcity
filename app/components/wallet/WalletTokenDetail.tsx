'use client';

import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeldTokenView } from './types';

interface WalletTokenDetailProps {
  token: HeldTokenView;
  chainLabel: string;
  explorerBase?: string;
  balanceLoading?: boolean;
  onSend: () => void;
  onReceive: () => void;
  onRemove?: () => void;
  activity?: ReactNode;
}

export function WalletTokenDetail({ token, chainLabel, explorerBase, balanceLoading, onSend, onReceive, onRemove, activity }: WalletTokenDetailProps) {
  const explorer = token.contract && explorerBase ? `${explorerBase}/address/${token.contract}` : explorerBase ? `${explorerBase}` : null;

  return (
    <section className="wallet-token-detail wtoken" aria-labelledby="wallet-token-detail-title">
      <div className="wtoken-hero">
        <span className="wh-mark" aria-hidden="true">{token.symbol.slice(0, 1)}</span>
        <div>
          <h3 id="wallet-token-detail-title">{token.name}</h3>
          <p>{token.symbol} · {chainLabel}</p>
        </div>
      </div>
      <p className="wallet-token-detail-balance">
        {balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : (token.balance || '—')}
      </p>
      <p className="wtoken-unit">{token.symbol}</p>
      <div className="wallet-token-detail-actions">
        <Button type="button" className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" onClick={onSend}>
          <ArrowUpRight size={16} /> Send
        </Button>
        <Button type="button" variant="outline" onClick={onReceive}>
          <ArrowDownLeft size={16} /> Receive
        </Button>
      </div>
      <dl className="wact-facts">
        <div><dt>Network</dt><dd>{chainLabel}</dd></div>
        {token.contract && <div><dt>Contract</dt><dd className="wtoken-contract">{token.contract}</dd></div>}
      </dl>
      {explorer && token.contract && (
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
