'use client';

import { BADGES, type BadgeId } from '../../lib/game-store';

const STICKER_FILL: Record<string, string> = {
  lime: '#d6ff55',
  coral: '#ff795f',
  sky: '#83d8ee',
  blush: '#f5a6c6',
  butter: '#ffe27a',
  sun: '#ffb35c',
  mint: '#8bffcc',
  ink: '#1c2925',
};

/**
 * Round enamel sticker with thick white border.
 * Passed `earned` toggles the full-color vs greyed-out look.
 */
export function BadgeSticker({
  id,
  size = 72,
  earned = true,
}: {
  id: BadgeId;
  size?: number;
  earned?: boolean;
}) {
  const def = BADGES.find((b) => b.id === id);
  if (!def) return null;
  const fill = STICKER_FILL[def.tone] ?? '#d6ff55';
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" className={earned ? '' : 'badge-locked'}>
      <circle cx="48" cy="48" r="46" fill="#fff" stroke="#1c2925" strokeWidth="4" />
      <circle cx="48" cy="48" r="40" fill={fill} opacity={earned ? 1 : 0.25} />
      {earned && <BadgeGlyph id={id} />}
      {!earned && <circle cx="48" cy="48" r="40" fill="#1c2925" opacity=".14" />}
    </svg>
  );
}

function BadgeGlyph({ id }: { id: BadgeId }) {
  const ink = '#1c2925';
  const common = { stroke: ink, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  switch (id) {
    case 'first-claim':
      return (
        <g {...common}>
          <path d="M48 30v26M34 40l14 8 14-8" />
        </g>
      );
    case 'explorer':
      return <g {...common}><path d="M26 40a22 22 0 1 0 12-20" /><path d="M26 40l-10-2 6-8 4 10Z" /></g>;
    case 'generous-tipper':
      return <g {...common}><path d="M48 62s-16-9-16-20a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 11-16 20-16 20Z" /></g>;
    case 'early-bird':
      return <g {...common}><path d="M30 58a18 18 0 1 1 26-15M28 68h40" /><path d="M62 44l-6 6-3-3" /></g>;
    case 'streak-flame':
      return <g {...common}><path d="M48 68c8 0 14-6 14-14 0-8-8-12-14-20-6 8-14 12-14 20 0 8 6 14 14 14Z" /></g>;
    case 'level-up':
      return <g {...common}><path d="M30 62 44 48l8 8 14-14" /><path d="M50 42h16v16" /></g>;
    case 'event-host':
      return <g {...common}><path d="M34 46h28M48 34v24" /><circle cx="48" cy="46" r="16" /></g>;
    case 'night-owl':
      return <g {...common}><path d="M64 32a18 18 0 1 0 4 26c-9-1-14-6-16-12 1 8 6 14 16 14 5 0 9-2 12-6-2 5-9 8-16 8Z" /></g>;
    default:
      return null;
  }
}
