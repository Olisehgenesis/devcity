'use client';

/**
 * "Dex" — the round robot courier mascot holding a gift crate.
 * Sticker style with thick outline + soft drop shadow. Transparent bg.
 */
export function DexMascot({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* floor shadow */}
      <ellipse cx="60" cy="106" rx="26" ry="8" fill="#1A1028" opacity=".16" />
      <circle cx="60" cy="62" r="30" fill="#FFF6FA" stroke="#1A1028" strokeWidth="3.5" />
      <line x1="60" y1="30" x2="60" y2="20" stroke="#1A1028" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="18" r="4.5" fill="#D01265" stroke="#1A1028" strokeWidth="2.5" />
      <circle cx="50" cy="58" r="4" fill="#1A1028" />
      <circle cx="70" cy="58" r="4" fill="#1A1028" />
      <circle cx="43" cy="66" r="4" fill="#FFF6FA" />
      <circle cx="77" cy="66" r="4" fill="#FFF6FA" />
      <path d="M52 72h16" stroke="#1A1028" strokeWidth="3" strokeLinecap="round" />
      <rect x="54" y="70" width="12" height="9" rx="3" fill="#00987F" stroke="#1A1028" strokeWidth="2.5" />
      <path d="M34 58h-4a3 3 0 0 0-3 3v0l6 6" stroke="#1A1028" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M86 58h4a3 3 0 0 1 3 3l-6 6" stroke="#1A1028" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <g>
        <rect x="46" y="36" width="28" height="22" rx="4" fill="#E45700" stroke="#1A1028" strokeWidth="3" />
        <path d="M46 44h28" stroke="#1A1028" strokeWidth="2.5" />
        <path d="M60 36v22" stroke="#00987F" strokeWidth="3" />
        <path d="M60 36c-3-1-5-3-5-6 0-4 3-6 5-6s5 2 5 6c0 3-2 5-5 6Z" fill="#FFF6FA" stroke="#1A1028" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

import { StickerStrip } from './CityStickers';

/** Smaller helper for empty-state usage */
export function DexEmpty({ size = 160, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <div className="dex-empty">
      <img className="empty-courier" src="/assets/original/empty-courier.jpg" alt="" width={size} height={size} />
      <img src="/assets/original/empty-city.svg" alt="" width={120} height={90} />
      <StickerStrip />
      {children}
    </div>
  );
}
