'use client';

import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import type { HeldTokenView } from './types';

interface WalletTokenDetailProps {
  token: HeldTokenView;
  explorerBase?: string;
  balanceLoading?: boolean;
  onSend: () => void;
  onReceive: () => void;
  onRemove?: () => void;
}

export function WalletTokenDetail({ token, explorerBase, balanceLoading, onSend, onReceive, onRemove }: WalletTokenDetailProps) {
  const explorer = token.contract && explorerBase ? `${explorerBase}/address/${token.contract}` : null;

  return (
    <section className="wallet-token-detail" aria-labelledby="wallet-token-detail-title">
      <p className="wallet-token-detail-balance">{balanceLoading ? <span className="balance-skeleton balance-skeleton-lg" /> : token.balance}</p>
      <h3 id="wallet-token-detail-title">{token.name}</h3>
      <div className="wallet-token-detail-actions">
        <button type="button" className="you-connect-primary" onClick={onSend}><ArrowUpRight size={16} /> Send</button>
        <button type="button" className="you-connect-secondary" onClick={onReceive}><ArrowDownLeft size={16} /> Receive</button>
      </div>
      {token.contract && <p className="wallet-receive-address">{token.contract}</p>}
      {explorer && (
        <a className="wallet-token-explorer" href={explorer} target="_blank" rel="noreferrer">
          View on explorer <ExternalLink size={13} />
        </a>
      )}
      {onRemove && (
        <button type="button" className="you-connect-secondary" onClick={onRemove}>
          Remove {token.symbol} from this list
        </button>
      )}
    </section>
  );
}
