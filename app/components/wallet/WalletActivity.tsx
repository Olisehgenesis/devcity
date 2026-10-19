'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Sparkles } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  amount?: string;
  tokenSymbol?: string;
  counterparty?: string;
  counterpartyAddress?: string;
  dropName?: string;
  tokenName?: string;
  status?: string;
  txHash?: string | null;
  message?: string;
  createdAt: string;
}

const LABELS: Record<string, string> = {
  tip_sent: 'Sent',
  tip_received: 'Received',
  claim: 'Claimed',
  token_created: 'Token launched',
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status?: string, txHash?: string | null) {
  if (!status) return txHash ? 'Submitted' : 'Recorded';
  const key = status.toUpperCase();
  if (key === 'CONFIRMED' || key === 'SUCCESS') return 'Confirmed';
  if (key === 'PENDING') return 'Pending';
  if (key === 'FAILED' || key === 'REVERTED') return 'Failed';
  return status;
}

function statusTone(label: string) {
  if (label === 'Failed') return 'is-failed';
  if (label === 'Pending') return 'is-pending';
  if (label === 'Confirmed') return 'is-ok';
  return '';
}

function short(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('0x') && value.length > 12) return `${value.slice(0, 6)}…${value.slice(-4)}`;
  return value;
}

export function WalletActivity({
  address,
  chainLabel,
  explorerBase,
  compact = false,
  limit,
  onViewAll,
  symbol,
}: {
  address: string;
  chainLabel?: string;
  explorerBase?: string;
  compact?: boolean;
  limit?: number;
  onViewAll?: () => void;
  symbol?: string;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received' | 'claims'>('all');

  useEffect(() => {
    const controller = new AbortController();
    setStatus((current) => current === 'ready' ? current : 'loading');
    fetch(`/api/wallet/transactions?userAddress=${encodeURIComponent(address)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { transactions?: ActivityItem[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load activity.');
        const next = data.transactions ?? [];
        setItems(next);
        setError('');
        setStatus(next.length ? 'ready' : 'empty');
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        const message = loadError instanceof Error ? loadError.message : '';
        setError(message && message !== 'Internal server error' ? message : 'Activity could not be loaded.');
        setStatus((current) => current === 'ready' ? 'ready' : 'error');
      });
    return () => controller.abort();
  }, [address, reloadKey]);

  const ordered = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = ordered.filter((item) => {
    if (symbol && item.tokenSymbol?.toUpperCase() !== symbol.toUpperCase()) return false;
    if (filter === 'sent') return item.type === 'tip_sent';
    if (filter === 'received') return item.type === 'tip_received' || item.type === 'claim';
    if (filter === 'claims') return item.type === 'claim';
    return true;
  });
  const visible = limit ? filtered.slice(0, limit) : filtered;

  if (selected && !compact) {
    const label = LABELS[selected.type] ?? selected.type;
    const state = statusLabel(selected.status, selected.txHash);
    const explorer = selected.txHash && explorerBase ? `${explorerBase}/tx/${selected.txHash}` : null;
    const outbound = selected.type === 'tip_sent';
    const Icon = selected.type === 'token_created' ? Sparkles : outbound ? ArrowUpRight : ArrowDownLeft;
    return (
      <section className="wallet-activity wtx" aria-labelledby="wallet-activity-detail-title">
        <button type="button" className="wtx-back" onClick={() => setSelected(null)}>Activity</button>
        <span className={`wtx-icon${outbound ? '' : ' is-in'}${state === 'Failed' ? ' is-failed' : ''}`} aria-hidden="true">
          <Icon size={22} />
        </span>
        <h3 id="wallet-activity-detail-title">{label}</h3>
        <p className="wtx-sub">{selected.tokenSymbol || selected.tokenName || selected.dropName || chainLabel}</p>
        <p className="wtx-amount">
          {selected.amount ? `${outbound ? '−' : '+'}${selected.amount}` : '—'}
          {selected.tokenSymbol ? <small> {selected.tokenSymbol}</small> : null}
        </p>
        <dl className="wact-facts">
          <div><dt>From</dt><dd>{outbound ? short(address) : (short(selected.counterpartyAddress) || selected.counterparty || selected.dropName || '—')}</dd></div>
          <div><dt>To</dt><dd>{outbound ? (short(selected.counterpartyAddress) || selected.counterparty || '—') : short(address)}</dd></div>
          {chainLabel && <div><dt>Network</dt><dd>{chainLabel}</dd></div>}
          <div><dt>Date</dt><dd>{formatWhen(selected.createdAt)}</dd></div>
          <div><dt>Status</dt><dd><span className={`wtx-pill ${statusTone(state)}`}>{state}</span></dd></div>
          {selected.txHash && <div><dt>Transaction</dt><dd>{short(selected.txHash)}</dd></div>}
          {selected.message && <div><dt>Note</dt><dd>{selected.message}</dd></div>}
          {state === 'Failed' && <div><dt>What happened</dt><dd>This did not confirm. It was not added to your balance.</dd></div>}
        </dl>
        {explorer && (
          <a className="wtx-explorer" href={explorer} target="_blank" rel="noreferrer">
            View on explorer <ExternalLink size={14} />
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="wallet-activity" aria-labelledby={compact ? undefined : 'wallet-activity-title'}>
      {!compact && <h3 id="wallet-activity-title" className="wact-sr">Activity</h3>}
      {!compact && (
        <div className="wact-filters" role="tablist" aria-label="Activity filter">
          {([
            ['all', 'All'],
            ['sent', 'Sent'],
            ['received', 'Received'],
            ['claims', 'Claims'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? 'is-active' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {status === 'loading' && (
        <ul className="wallet-activity-list" aria-hidden="true">
          <li><span className="balance-skeleton balance-skeleton-lg" /></li>
          <li><span className="balance-skeleton balance-skeleton-lg" /></li>
        </ul>
      )}
      {error && (
        <p className="you-error" role="alert">
          {error}{' '}
          <button type="button" className="wallet-retry" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </p>
      )}
      {status === 'empty' && <p className="wact-empty">No recorded activity yet. Sends, tips, and claims will show up here.</p>}
      {status === 'ready' && visible.length === 0 && (
        <p className="wact-empty">{symbol ? `No recorded activity for ${symbol}.` : 'Nothing in this filter.'}</p>
      )}
      {status === 'ready' && visible.length > 0 && (
        <ul className="wallet-activity-list">
          {visible.map((item) => {
            const label = LABELS[item.type] ?? item.type;
            const state = statusLabel(item.status, item.txHash);
            const inbound = item.type === 'tip_received' || item.type === 'claim';
            const Icon = item.type === 'token_created' ? Sparkles : inbound ? ArrowDownLeft : ArrowUpRight;
            const detail = [
              item.counterparty,
              item.dropName,
              item.tokenName && item.type === 'token_created' ? item.tokenName : '',
              !compact ? chainLabel : '',
              formatWhen(item.createdAt),
            ].filter(Boolean).join(' · ');
            const body = (
              <>
                <span className={`wact-icon${inbound ? ' is-in' : ''}`} aria-hidden="true"><Icon size={16} /></span>
                <span className="wact-copy">
                  <strong>{label}{item.tokenSymbol ? ` ${item.tokenSymbol}` : ''}</strong>
                  <small>{detail}</small>
                </span>
                <span className="wact-side">
                  <strong>{item.amount ? `${inbound ? '+' : '−'}${item.amount}` : ''}</strong>
                  <small className={`wact-status ${statusTone(state)}`}>{state}</small>
                </span>
              </>
            );
            return (
              <li key={`${item.type}-${item.id}`}>
                {compact ? (
                  <div className="wact-row">{body}</div>
                ) : (
                  <button type="button" className="wact-row" onClick={() => setSelected(item)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {compact && onViewAll && (
        <button type="button" className="wact-viewall" onClick={onViewAll}>View all</button>
      )}
    </section>
  );
}
