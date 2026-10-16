'use client';

import { avatarBackgroundForColor, dicebearAvatarUrl } from '../../lib/avatars';

/**
 * Presence cloud / avatar bubble. Round, soft shadow, approximate (never an exact pin).
 * `ghost` shows a translucent hidden state with the ghost icon.
 */
export function AvatarBubble({
  name,
  seed,
  src,
  tone = 'lime',
  size = 44,
  status,
  ghost = false,
}: {
  name?: string;
  seed?: string;
  src?: string | null;
  tone?: string;
  size?: number;
  status?: 'online' | 'away' | 'offline';
  ghost?: boolean;
}) {
  const image = src ?? (seed ? dicebearAvatarUrl(seed, avatarBackgroundForColor(tone)) : null);
  const initials = (name ?? '?').slice(0, 2).toUpperCase();
  return (
    <span
      className={`avatar-bubble tone-${tone}${ghost ? ' is-ghost' : ''}`}
      style={{ width: size, height: size }}
      aria-label={name ?? 'person'}
    >
      {ghost ? (
        <span className="avatar-bubble-ghost">·</span>
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : (
        <span>{initials}</span>
      )}
      {status && status !== 'offline' && <i className={`avatar-live status-${status}`} />}
    </span>
  );
}

/** Small labelled cloud used in the People list. */
export function PresenceCloud({ name, tone = 'sky', ghost = false }: { name: string; tone?: string; ghost?: boolean }) {
  return (
    <span className={`presence-cloud tone-${tone}${ghost ? ' is-ghost' : ''}`}>
      <AvatarBubble name={name} tone={tone} ghost={ghost} size={40} />
      <small>{name}</small>
    </span>
  );
}
