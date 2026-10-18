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
          <circle cx="60" cy="58" r="34" fill="#D01265" opacity=".18" />
          <circle cx="60" cy="58" r="46" fill="#D01265" opacity=".1" />
        </>
      )}
      {/* crate body */}
      <g stroke="#1A1028" strokeWidth="3" strokeLinejoin="round">
        <path d="M30 52 60 36l30 16-30 16-30-16Z" fill="#E45700" />
        <path d="M30 52v20l30 16V68L30 52Z" fill="#D01265" />
        <path d="M90 52v20L60 88V68l30-16Z" fill="#00987F" />
        <path d="M60 36v32" fill="none" />
      </g>
      {/* ribbon */}
      <g stroke="#1A1028" strokeWidth="3" strokeLinejoin="round">
        <path d="M60 48v20" stroke="#FFF6FA" />
        <path d="M60 58l-12 6m12-6 12 6" stroke="#FFF6FA" />
      </g>
      {/* glow beacon */}
      <path d="M60 22v-8M60 96v6" stroke="#1A1028" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <path d="M60 14l4 5h-8l4-5Z" fill="#E45700" stroke="#1A1028" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
