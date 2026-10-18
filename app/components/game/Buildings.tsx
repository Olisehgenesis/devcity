'use client';

/**
 * Set of 6 tiny isometric city buildings (stage, café, booth, hub tower,
 * gazebo, info kiosk). Consistent flat style, soft shadows, sprite sheet
 * approach via a single component keyed by id.
 */
export type BuildingId = 'stage' | 'cafe' | 'booth' | 'tower' | 'gazebo' | 'kiosk';

export function BuildingSprite({ id, size = 56 }: { id: BuildingId; size?: number }) {
  const g = (children: React.ReactNode) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="building-sprite">
      <g stroke="#1A1028" strokeWidth="2.6" strokeLinejoin="round">{children}</g>
    </svg>
  );
  const ink = '#1A1028';
  const f = (hex: string) => ({ fill: hex, stroke: ink });
  const roofline = (hex: string) => ({ fill: hex, stroke: ink });

  switch (id) {
    case 'stage':
      return g(
        <g>
          <path d="M12 42h40v10H12Z" {...roofline('#D01265')} />
          <path d="M22 52v6h20M24 40h16" {...roofline('#D01265')} />
          <path d="M18 40h6v6" {...roofline('#D01265')} />
        </g>,
      );
    case 'cafe':
      return g(
        <g>
          <rect x="20" y="28" width="14" height="18" rx="2" {...f('#00987F')} />
          <rect x="34" y="20" width="10" height="26" rx="2" {...f('#ffe27a')} />
          <rect x="22" y="18" width="6" rx="3" {...f('#fffef9')} />
        </g>,
      );
    case 'booth':
      return g(
        <g>
          <path d="M18 30 32 22v20H18Z" {...f('#00987F')} />
          <path d="M32 24v18h14v0H32Z" {...f('#00987F')} />
        </g>,
      );
    case 'tower':
      return g(
        <g>
          <rect x="22" y="20" width="20" height="26" {...f('#D01265')} />
          <path d="M24 20V10l16-4v14" {...f('#00987F')} />
          <path d="M22 34h20" stroke="#1A1028" />
        </g>,
      );
    case 'gazebo':
      return g(
        <g>
          <path d="M12 26h40l-6 14H18l-6-14Z" {...f('#8bffcc')} />
          <rect x="18" y="40" width="28" height="8" rx="2" {...f('#fffef9')} />
          <path d="M32 12v14" stroke="#1A1028" />
        </g>,
      );
    case 'kiosk':
      return g(
        <g>
          <rect x="20" y="26" width="24" height="18" rx="2" {...f('#00987F')} />
          <path d="M20 38h24" stroke="#1A1028" />
          <path d="M22 30h20" stroke="#1A1028" strokeWidth="2" />
        </g>,
      );
    default:
      return g(<rect x="20" y="22" width="24" height="26" rx="2" {...f('#00987F')} />);
  }
}
