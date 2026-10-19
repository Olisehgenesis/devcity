'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BADGES, useGameStore } from '../../lib/game-store';

type CityDrop = {
  id: string;
  name: string;
  tokenSymbol?: string | null;
  creatorAddress?: string | null;
};

type ClaimRow = {
  id: string;
  amount?: string;
  tokenSymbol?: string;
  dropName?: string;
  status?: string;
  txHash?: string | null;
  createdAt: string;
};

function statusLabel(status?: string) {
  const key = (status ?? '').toUpperCase();
  if (key === 'CONFIRMED') return 'Confirmed';
  if (key === 'PENDING') return 'Pending';
  if (key === 'FAILED') return 'Failed';
  return status || 'Recorded';
}

export function WalletCityTab({
  address,
  explorerBase,
  onCreateDrop,
}: {
  address: string;
  explorerBase?: string;
  onCreateDrop?: () => void;
}) {
  const badges = useGameStore((state) => state.badges);
  const load = useGameStore((state) => state.load);
  const [drops, setDrops] = useState<CityDrop[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimState, setClaimState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    void load(address);
  }, [address, load]);

  useEffect(() => {
    let active = true;
    void fetch('/api/drops')
      .then((response) => response.ok ? response.json() as Promise<{ drops?: CityDrop[] }> : null)
      .then((data) => {
        if (!active || !data) return;
        setDrops((data.drops ?? []).filter((drop) => drop.creatorAddress?.toLowerCase() === address.toLowerCase()));
      })
      .catch(() => {
        if (active) setDrops([]);
      });
    return () => { active = false; };
  }, [address]);

  useEffect(() => {
    const controller = new AbortController();
    setClaimState('loading');
    fetch(`/api/wallet/transactions?userAddress=${encodeURIComponent(address)}&type=claims`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { transactions?: ClaimRow[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load claims.');
        setClaims(data.transactions ?? []);
        setClaimState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setClaimState('error');
      });
    return () => controller.abort();
  }, [address]);

  const earned = BADGES.filter((badge) => badges.includes(badge.id));

  return (
    <div className="wallet-city">
      <section className="wdash-card" aria-labelledby="wallet-badges-title">
        <header><h2 id="wallet-badges-title">Badges</h2></header>
        {earned.length === 0 ? (
          <p className="wact-empty">Badges show up after a real claim, tip, or event.</p>
        ) : (
          <ul className="wallet-city-list">
            {earned.map((badge) => (
              <li key={badge.id}>
                <strong>{badge.label}</strong>
                <span>{badge.blurb}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wdash-card" aria-labelledby="wallet-claims-title">
        <header>
          <h2 id="wallet-claims-title">Claims</h2>
          {claimState === 'ready' && <span>{claims.length} recorded</span>}
        </header>
        {claimState === 'loading' && (
          <ul className="wallet-activity-list" aria-busy="true" aria-hidden="true">
            <li className="wact-skel" />
            <li className="wact-skel" />
          </ul>
        )}
        {claimState === 'error' && (
          <p className="wact-empty" role="alert">Claims could not be loaded.</p>
        )}
        {claimState === 'ready' && claims.length === 0 && <p className="wact-empty">No claims yet.</p>}
        {claimState === 'ready' && claims.length > 0 && (
          <ul className="wallet-city-list">
            {claims.map((claim) => {
              const explorer = claim.txHash && explorerBase ? `${explorerBase}/tx/${claim.txHash}` : null;
              const state = statusLabel(claim.status);
              return (
                <li key={claim.id}>
                  <strong>{claim.dropName || 'Drop'}</strong>
                  <span>
                    {claim.amount ? `${claim.amount} ${claim.tokenSymbol ?? ''}`.trim() : 'Amount unavailable'}
                    {' · '}{state}
                  </span>
                  {explorer && (
                    <a href={explorer} target="_blank" rel="noreferrer">
                      View transaction <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="wdash-card" aria-labelledby="wallet-drops-title">
        <header><h2 id="wallet-drops-title">Drops you created</h2></header>
        {drops.length === 0 ? (
          <p className="wact-empty">No drops from this wallet yet.</p>
        ) : (
          <ul className="wallet-city-list">
            {drops.map((drop) => (
              <li key={drop.id}>
                <strong>{drop.name}</strong>
                <span>{drop.tokenSymbol || 'Token unavailable'}</span>
              </li>
            ))}
          </ul>
        )}
        {onCreateDrop && (
          <Button type="button" variant="outline" onClick={onCreateDrop}>Create a drop</Button>
        )}
      </section>
    </div>
  );
}
