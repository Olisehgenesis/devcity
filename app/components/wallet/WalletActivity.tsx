'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { TokenMark } from './TokenMark';

interface ActivityItem {
  id: string;
  type: string;
  amount?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDescription?: string;
  tokenIconUrl?: string | null;
  contractAddress?: string | null;
  maxSupply?: string;
  counterparty?: string;
  counterpartyAddress?: string;
  counterpartyAvatar?: string | null;
  dropName?: string;
  status?: string;
  txHash?: string | null;
  message?: string;
  createdAt: string;
}

const LABELS: Record<string, string> = {
  tip_sent: 'Tip',
  tip_received: 'Received',
  claim: 'Claim',
  token_created: 'Profile token',
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

function ActivityMark({ item, large = false }: { item: ActivityItem; large?: boolean }) {
  return (
    <span className={large ? 'wtx-icon' : 'wact-mark'} aria-hidden="true">
      <TokenMark symbol={item.tokenSymbol || item.tokenName || 'Token'} src={item.tokenIconUrl} />
    </span>
  );
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
        setError('Activity could not be loaded.');
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
    const facts: Array<[string, string]> = [
      ['Token', selected.tokenName || ''],
      ['Symbol', selected.tokenSymbol || ''],
      ['From', outbound ? short(address) : (short(selected.counterpartyAddress) || selected.counterparty || selected.dropName || '—')],
      ['To', outbound ? (short(selected.counterpartyAddress) || selected.counterparty || '—') : short(address)],
      ['Drop', selected.dropName || ''],
      ['Network', chainLabel || ''],
      ['Date', formatWhen(selected.createdAt)],
      ['Status', state],
      ['Supply', selected.type === 'token_created' ? (selected.maxSupply || selected.amount || '') : ''],
      ['Contract', selected.contractAddress ? short(selected.contractAddress) : ''],
      ['Transaction', selected.txHash ? short(selected.txHash) : ''],
      ['Note', selected.message || ''],
      ['About', selected.tokenDescription || ''],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (state === 'Failed') facts.push(['What happened', 'This did not confirm. It was not added to your balance.']);
    return (
      <section className="wallet-activity wtx" aria-labelledby="wallet-activity-detail-title">
        <button type="button" className="wtx-back" onClick={() => setSelected(null)}>Activity</button>
        <ActivityMark item={selected} large />
        <h3 id="wallet-activity-detail-title">{label}</h3>
        <p className="wtx-sub">{selected.tokenName || selected.tokenSymbol || selected.dropName || chainLabel}</p>
        <p className="wtx-amount">
          {selected.amount ? `${outbound ? '−' : selected.type === 'token_created' ? '' : '+'}${selected.amount}` : '—'}
          {selected.tokenSymbol ? <small> {selected.tokenSymbol}</small> : null}
        </p>
        <dl className="wact-facts">
          {facts.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{name === 'Status' ? <span className={`wtx-pill ${statusTone(state)}`}>{value}</span> : value}</dd>
            </div>
          ))}
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
          <li className="wact-skel" />
          <li className="wact-skel" />
          <li className="wact-skel" />
        </ul>
      )}
      {error && (
        <p className="wact-empty" role="alert">
          {error}{' '}
          <button type="button" className="wallet-retry" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </p>
      )}
      {status === 'empty' && <p className="wact-empty">No activity yet.</p>}
      {status === 'ready' && visible.length === 0 && (
        <p className="wact-empty">{symbol ? `No recorded activity for ${symbol}.` : 'Nothing in this filter.'}</p>
      )}
      {status === 'ready' && visible.length > 0 && (
        <ul className="wallet-activity-list">
          {visible.map((item) => {
            const label = LABELS[item.type] ?? item.type;
            const state = statusLabel(item.status, item.txHash);
            const inbound = item.type === 'tip_received' || item.type === 'claim';
            const who = item.counterparty || item.dropName || item.tokenName || '';
            const body = (
              <>
                <ActivityMark item={item} />
                <span className="wact-copy">
                  <strong>{label}{item.tokenSymbol ? ` ${item.tokenSymbol}` : ''}</strong>
                  <small>{who || chainLabel || 'This wallet'}</small>
                </span>
                <span className="wact-side">
                  <strong>{item.amount ? `${inbound ? '+' : item.type === 'token_created' ? '' : '−'}${item.amount}` : ''}</strong>
                  <small className={`wact-chip ${statusTone(state)}`}>{state}</small>
                  <small className="wact-time">{formatWhen(item.createdAt)}</small>
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
