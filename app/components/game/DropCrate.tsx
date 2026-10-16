'use client';

/**
 * Isometric loot crate with gold ribbon + glowing beacon.
 * Flat vector, chunky outline, transparent background.
 */
export function DropCrate({ size = 96, beacon = true }: { size?: number; beacon?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true" className="drop-crate">
      {beacon && (
        <>
          <circle cx="60" cy="58" r="34" fill="#ff795f" opacity=".18" />
          <circle cx="60" cy="58" r="46" fill="#ff795f" opacity=".1" />
        </>
      )}
      {/* crate body */}
      <g stroke="#1c2925" strokeWidth="3" strokeLinejoin="round">
        <path d="M30 52 60 36l30 16-30 16-30-16Z" fill="#ffb35c" />
        <path d="M30 52v20l30 16V68L30 52Z" fill="#e28a2a" />
        <path d="M90 52v20L60 88V68l30-16Z" fill="#f4a03e" />
        <path d="M60 36v32" fill="none" />
      </g>
      {/* gold ribbon */}
      <g stroke="#1c2925" strokeWidth="3" strokeLinejoin="round">
        <path d="M60 48v20" stroke="#ffe27a" />
        <path d="M60 58l-12 6m12-6 12 6" stroke="#ffe27a" />
      </g>
      {/* glow beacon */}
      <path d="M60 22v-8M60 96v6" stroke="#1c2925" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <path d="M60 14l4 5h-8l4-5Z" fill="#ffe27a" stroke="#1c2925" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
