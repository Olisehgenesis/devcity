'use client';

/**
 * "Dex" — the round robot courier mascot holding a gift crate.
 * Sticker style with thick outline + soft drop shadow. Transparent bg.
 */
export function DexMascot({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      {/* floor shadow */}
      <ellipse cx="60" cy="106" rx="26" ry="8" fill="#1c2925" opacity=".16" />
      {/* body */}
      <circle cx="60" cy="62" r="30" fill="#fffef9" stroke="#1c2925" strokeWidth="3.5" />
      {/* antenna */}
      <line x1="60" y1="30" x2="60" y2="20" stroke="#1c2925" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="18" r="4.5" fill="#ff795f" stroke="#1c2925" strokeWidth="2.5" />
      {/* eyes */}
      <circle cx="50" cy="58" r="4" fill="#1c2925" />
      <circle cx="70" cy="58" r="4" fill="#1c2925" />
      {/* cheeks */}
      <circle cx="43" cy="66" r="4" fill="#ffd9d2" />
      <circle cx="77" cy="66" r="4" fill="#ffd9d2" />
      {/* mouth */}
      <path d="M52 72h16" stroke="#1c2925" strokeWidth="3" strokeLinecap="round" />
      {/* chest panel */}
      <rect x="54" y="70" width="12" height="9" rx="3" fill="#d6ff55" stroke="#1c2925" strokeWidth="2.5" />
      {/* arms holding crate */}
      <path d="M34 58h-4a3 3 0 0 0-3 3v0l6 6" stroke="#1c2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M86 58h4a3 3 0 0 1 3 3l-6 6" stroke="#1c2925" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* gift crate */}
      <g>
        <rect x="46" y="36" width="28" height="22" rx="4" fill="#ffb35c" stroke="#1c2925" strokeWidth="3" />
        <path d="M46 44h28" stroke="#1c2925" strokeWidth="2.5" />
        <path d="M60 36v22" stroke="#d6ff55" strokeWidth="3" />
        <path d="M60 36c-3-1-5-3-5-6 0-4 3-6 5-6s5 2 5 6c0 3-2 5-5 6Z" fill="#fffef9" stroke="#1c2925" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** Smaller helper for empty-state usage */
export function DexEmpty({ size = 92, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <div className="dex-empty">
      <DexMascot size={size} />
      {children}
    </div>
  );
}
