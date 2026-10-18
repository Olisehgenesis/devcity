const COLORS = ['#D01265', '#00987F', '#E45700'] as const;
const INK = '#1A1028';
const PAPER = '#FFF6FA';

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Original geometric avatar. It does not call Dicebear or any other avatar brand. */
export function originalAvatarDataUri(seed: string): string {
  const hash = hashSeed(seed || 'devcity');
  const ground = COLORS[hash % 3];
  const accent = COLORS[(hash >>> 3) % 3];
  const eye = (hash >>> 6) % 3;
  const eyes = eye === 0
    ? `<circle cx="30" cy="36" r="3.2" fill="${INK}"/><circle cx="50" cy="36" r="3.2" fill="${INK}"/>`
    : eye === 1
      ? `<path d="M26 36h8M46 36h8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
      : `<circle cx="30" cy="36" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="36" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>`;
  const mouth = (hash >>> 9) % 2 === 0
    ? `<path d="M32 50c4 5 12 5 16 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
    : `<path d="M33 52h14" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="28" fill="${ground}"/><circle cx="40" cy="42" r="22" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>${eyes}${mouth}<circle cx="62" cy="18" r="8" fill="${accent}" stroke="${INK}" stroke-width="2.5"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
