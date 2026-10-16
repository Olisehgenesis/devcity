'use client';

/**
 * DEVCITY26 game-fied nav icons.
 * Chunky outline, duotone (lime body + coral accent), consistent 24x24 grid,
 * same family as public/devcity-mark.svg.
 * Usage: <GameIcon name="map" />
 */
export type GameIconName =
  | 'map'
  | 'feed'
  | 'scan'
  | 'inbox'
  | 'wallet'
  | 'ghost'
  | 'vault'
  | 'drop'
  | 'spark';

const LIME = '#d6ff55';
const CORAL = '#ff795f';
const INK = '#1c2925';

function Icon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  );
}

export function GameIcon({ name, size = 24, className = '' }: { name: GameIconName; size?: number; className?: string }) {
  let node: React.ReactNode;
  switch (name) {
    case 'map':
      node = (
        <Icon size={size}>
          <path d="M3 6.5 9 4l6 2.5L21 4v13l-6 2.5L9 17 3 19.5V6.5Z" fill={LIME} strokeWidth={2} />
          <path d="M9 4v13M15 6.5V19" strokeWidth={1.6} />
          <circle cx="9" cy="9" r="2.4" fill={CORAL} stroke="none" />
        </Icon>
      );
      break;
    case 'feed':
      node = (
<Icon size={size}>
          <path d="M4 7a12 12 0 0 1 16 0" fill="none" />
          <path d="M7 11a8 8 0 0 1 10 0" fill="none" />
          <path d="M10 15a4 4 0 0 1 4 0" fill="none" />
          <circle cx="12" cy="19" r="1.8" fill={CORAL} stroke="none" />
        </Icon>
      );
      break;
    case 'scan':
      node = (
<Icon size={size}>
          <rect x="6" y="6" width="12" height="12" rx="3" fill={LIME} strokeWidth={2} />
          <path d="M6 9V8a2 2 0 0 1 2-2h1M18 9V8a2 2 0 0 0-2-2h-1M6 15v1a2 2 0 0 0 2 2h1M18 15v1a2 2 0 0 1-2 2h-1" strokeWidth={2} />
          <circle cx="12" cy="12" r="2" fill={CORAL} stroke="none" />
        </Icon>
      );
      break;
    case 'inbox':
      node = (
<Icon size={size}>
          <path d="M5 4h14l2 7v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7l2-7Z" fill={LIME} strokeWidth={2} />
          <path d="M3 11h5a4 4 0 0 0 8 0h5" fill="none" />
          <path d="M12 15V7m0 0-3 3m3-3 3 3" strokeWidth={2} />
        </Icon>
      );
      break;
    case 'wallet':
      node = (
<Icon size={size}>
          <rect x="3" y="7" width="18" height="13" rx="3" fill={LIME} strokeWidth={2} />
          <path d="M3 11h18" strokeWidth={2} />
          <circle cx="16.5" cy="15.5" r="1.5" fill={CORAL} stroke="none" />
          <path d="M3 7 8 4h9a2 2 0 0 1 2 2" strokeWidth={2} />
        </Icon>
      );
      break;
    case 'ghost':
      node = (
<Icon size={size}>
          <path d="M6 12a6 6 0 0 1 12 0v6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-6Z" fill={LIME} strokeWidth={2} />
          <path d="M9 10h.01M15 10h.01" strokeWidth={2.4} />
          <path d="M9 16c1.2 1 2.6 1 3.8 0" strokeWidth={2} />
        </Icon>
      );
      break;
    case 'vault':
      node = (
<Icon size={size}>
          <rect x="4" y="7" width="16" height="12" rx="3" fill={LIME} strokeWidth={2} />
          <circle cx="12" cy="13" r="2.6" fill="none" />
          <path d="M12 8v2M12 16v2M8 13h2M14 13h2" strokeWidth={1.6} />
        </Icon>
      );
      break;
    case 'drop':
      node = (
<Icon size={size}>
          <path d="M12 3c2.6 2.4 4.5 4.5 4.5 6.8a4.5 4.5 0 0 1-9 0C7.5 7.5 9.4 5.4 12 3Z" fill={LIME} strokeWidth={2} />
          <path d="M9.5 9.8h5" strokeWidth={1.8} />
        </Icon>
      );
      break;
    case 'spark':
      node = (
<Icon size={size}>
          <path d="M12 3v4M12 17v4M5 12h4M15 12h4" strokeWidth={2} />
          <path d="M12 12l-2.6-2.6M12 12l2.6 2.6M12 12l-2.6 2.6M12 12l2.6-2.6" strokeWidth={2} />
        </Icon>
      );
      break;
  }
  return (
    <span className={`game-icon ${className}`} style={{ width: size, height: size, display: 'inline-flex' }}>
      {node}
    </span>
  );
}
