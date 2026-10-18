'use client';

import { useEffect, useState } from 'react';
import { BADGES, useGameStore } from '../../lib/game-store';

type CityDrop = {
  id: string;
  name: string;
  tokenSymbol?: string | null;
  creatorAddress?: string | null;
};

export function WalletCityTab({ address }: { address: string }) {
  const badges = useGameStore((state) => state.badges);
  const claims = useGameStore((state) => state.counts.claims);
  const load = useGameStore((state) => state.load);
  const [drops, setDrops] = useState<CityDrop[]>([]);

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

  const earned = BADGES.filter((badge) => badges.includes(badge.id));

  return (
    <section className="wallet-city-tab" aria-label="Badges and drops">
      <h3>Badges</h3>
      {earned.length === 0 ? (
        <p className="you-note">Badges show up after a real claim, tip, or event.</p>
      ) : (
        <ul className="wallet-city-list">
          {earned.map((badge) => (
            <li key={badge.id}><strong>{badge.label}</strong><span>{badge.blurb}</span></li>
          ))}
        </ul>
      )}
      <h3>Drops</h3>
      <p className="you-note">{claims} claimed</p>
      {drops.length === 0 ? (
        <p className="you-note">Drops you create show up here.</p>
      ) : (
        <ul className="wallet-city-list">
          {drops.map((drop) => (
            <li key={drop.id}><strong>{drop.name}</strong><span>{drop.tokenSymbol || 'Drop'}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
