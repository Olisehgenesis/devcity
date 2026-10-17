'use client';

import { useEffect, useState } from 'react';

interface ActivityItem {
  id: string;
  type: string;
  amount?: string;
  tokenSymbol?: string;
  counterparty?: string;
  dropName?: string;
  tokenName?: string;
  status?: string;
  txHash?: string | null;
  createdAt: string;
}

const LABELS: Record<string, string> = {
  tip_sent: 'Tip sent',
  tip_received: 'Tip received',
  claim: 'Drop claimed',
  token_created: 'Token launched',
};

export function WalletActivity({ address }: { address: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

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
        setError(loadError instanceof Error ? loadError.message : 'Could not load activity.');
        setStatus((current) => current === 'ready' ? 'ready' : 'error');
      });
    return () => controller.abort();
  }, [address, reloadKey]);

  return (
    <section className="wallet-activity" aria-labelledby="wallet-activity-title">
      <h3 id="wallet-activity-title">Activity</h3>
      <p className="you-note">Tips, claims, and tokens recorded for this wallet. Profile activity on your city profile stays separate.</p>
      {status === 'loading' && (
        <ul className="wallet-activity-list" aria-hidden="true">
          <li><span className="balance-skeleton balance-skeleton-lg" /></li>
          <li><span className="balance-skeleton balance-skeleton-lg" /></li>
          <li><span className="balance-skeleton" /></li>
        </ul>
      )}
      {error && (
        <p className="you-error" role="alert">
          {error} <button type="button" className="wallet-retry" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </p>
      )}
      {status === 'empty' && <p className="you-note">No recorded activity yet. Claims and tips will show up here.</p>}
      {status === 'ready' && (
        <ul className="wallet-activity-list">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <span>
                <strong>{LABELS[item.type] ?? item.type}</strong>
                <small>
                  {item.counterparty ? `${item.counterparty} · ` : ''}
                  {item.dropName ? `${item.dropName} · ` : ''}
                  {item.tokenName ? `${item.tokenName} · ` : ''}
                  {item.status ? `${item.status} · ` : ''}
                  {new Date(item.createdAt).toLocaleString()}
                </small>
              </span>
              <strong>
                {item.amount ? `${item.amount} ` : ''}{item.tokenSymbol ?? ''}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
