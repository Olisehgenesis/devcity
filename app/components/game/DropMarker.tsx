'use client';

import { DropCrate } from './DropCrate';
import { TokenCoin } from './TokenCard';

/**
 * DropMarker — game-styled map marker for a token drop: chunky rounded
 * capsule with an isometric loot crate + soft shadow.
 */
export function DropMarker({
  amount,
  token,
  claimed,
  selected,
}: {
  amount: string;
  token: string;
  claimed?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className={`drop-marker${claimed ? ' is-claimed' : ''}${selected ? ' is-selected' : ''}`}
      aria-label={`${amount} ${token} token drop`}
    >
      <DropCrate size={34} beacon={!claimed} />
      <span className="drop-marker-amount">
        <strong>{amount}</strong>
        <small>{token}</small>
      </span>
    </button>
  );
}

/** Plain coin bubble used for person/place markers inside map content. */
export function MapCoin({ token }: { token: string }) {
  return <TokenCoin symbol={token} size={26} />;
}
