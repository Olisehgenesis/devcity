export const BRAND = {
  primary: '#D01265',
  secondary: '#00987F',
  accent: '#E45700',
  ink: '#1A1028',
  paper: '#FFF6FA',
  muted: '#5C4A62',
} as const;

export type CityPinKind = 'person' | 'place' | 'event' | 'drop';

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&apos;';
    }
  });
}

function fillFor(kind: CityPinKind, past: boolean): string {
  if (past) return BRAND.muted;
  if (kind === 'person') return BRAND.secondary;
  if (kind === 'place') return BRAND.secondary;
  if (kind === 'event') return BRAND.accent;
  return BRAND.primary;
}

/**
 * The original people pin. Friends on the map do not use this; person markers do.
 * Leave the geometry alone.
 */
function personPin(cx: number, fill: string, ring: string, selected: boolean, live: boolean): string {
  return [
    `<path d="M${cx} 89 C ${cx - 8} 76, ${cx - 18} 68, ${cx - 18} 54 A 18 18 0 1 1 ${cx + 18} 54 C ${cx + 18} 68, ${cx + 8} 76, ${cx} 89 Z" fill="${BRAND.paper}" stroke="${BRAND.ink}" stroke-width="2" stroke-linejoin="round"/>`,
    `<circle class="event-pin-ring" cx="${cx}" cy="54" r="16" fill="none" stroke="${ring}" stroke-width="2" opacity="${selected || live ? '1' : '0'}"/>`,
    `<circle cx="${cx}" cy="54" r="10" fill="${fill}"/>`,
    `<g transform="translate(${cx - 8} 46) scale(0.6667)" fill="none" stroke="${BRAND.ink}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5v-1.2a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1.2"/></g>`,
  ].join('');
}

/** Screen size for non-person markers. 0.5 at city zoom, about 1.2 at street zoom. */
export function markerScaleForZoom(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 11) / 6));
  return Math.round((0.5 + t * 0.72) * 1000) / 1000;
}

type Faces = { top: string; front: string; side: string };

function facesFor(kind: CityPinKind, past: boolean): Faces {
  if (past) return { top: '#C4B6C8', front: '#5C4A62', side: '#3E3144' };
  if (kind === 'event') return { top: '#FFC49A', front: '#E45700', side: '#A33C00' };
  if (kind === 'drop') return { top: '#F7A3C6', front: '#D01265', side: '#8E0C45' };
  return { top: '#7FE0CE', front: '#00987F', side: '#006856' };
}

/**
 * Stage, crate, and shop. Same upper-left light, paper edge, soft ground shadow,
 * and a tail whose tip is (32, 78). Not a pin, circle, or badge.
 */
function object3d(kind: CityPinKind, past: boolean): string {
  const { top, front, side } = facesFor(kind, past);
  const paper = BRAND.paper;
  const shadow = `<ellipse cx="32" cy="58" rx="18" ry="4.2" fill="rgba(26,16,40,.2)"/>`;
  const tail = `<path d="M28 60h8l-4 18z" fill="${front}" stroke="${paper}" stroke-width="1.6" stroke-linejoin="round"/>`;
  if (kind === 'event') {
    return [
      shadow,
      `<path d="M12 36 L32 16 L32 32 L18 42 Z" fill="${top}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M32 16 L54 36 L48 42 L32 32 Z" fill="${side}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M18 40 L32 32 L48 40 L48 54 L32 62 L18 54 Z" fill="${front}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M26 48h12l-2 10H28z" fill="${paper}"/>`,
      `<path d="M32 18v12" fill="none" stroke="${paper}" stroke-width="1.6" stroke-linecap="round"/>`,
      tail,
    ].join('');
  }
  if (kind === 'drop') {
    return [
      shadow,
      `<path d="M14 32 L32 22 L50 32 L32 42 Z" fill="${top}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M14 32 L32 42 L32 56 L14 46 Z" fill="${front}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M32 42 L50 32 L50 46 L32 56 Z" fill="${side}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
      `<path d="M30 24h4l2 30h-8z" fill="${paper}"/>`,
      `<path d="M18 32h28" fill="none" stroke="${paper}" stroke-width="2" stroke-linecap="round"/>`,
      tail,
    ].join('');
  }
  return [
    shadow,
    `<path d="M34 28 L52 36 L52 52 L34 60 Z" fill="${side}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M12 36 L34 26 L34 58 L12 66 Z" fill="${paper}" stroke="${BRAND.ink}" stroke-width="1.4" stroke-linejoin="round"/>`,
    `<path d="M8 38 L30 24 L56 36 L34 48 Z" fill="${front}" stroke="${paper}" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M20 48 L28 45 L28 62 L20 64 Z" fill="${front}"/>`,
    `<path d="M14 42h8v5h-8z" fill="${top}"/>`,
    tail,
  ].join('');
}

/**
 * People stay on the original pin. Events, drops, and places are separate 3D
 * objects with a tail whose tip is the bottom-center anchor.
 */
export function cityPinSvg(input: {
  kind: CityPinKind;
  title: string;
  selected?: boolean;
  live?: boolean;
  past?: boolean;
}): { svg: string; width: number; height: number; anchor: 'bottom' } {
  const title = input.title.replace(/\s+/g, ' ').trim() || 'Marker';
  const label = escapeXml(title.length > 18 ? `${title.slice(0, 17).trimEnd()}…` : title);
  const labelWidth = Math.min(148, Math.max(64, Math.min(title.length, 18) * 7.2 + 22));
  const width = Math.round(Math.max(48, labelWidth + 12));
  const height = input.kind === 'person' ? 90 : 96;
  const cx = width / 2;
  const labelX = cx - labelWidth / 2;
  const fill = fillFor(input.kind, Boolean(input.past));
  const ring = input.live ? BRAND.accent : BRAND.ink;
  const body = input.kind === 'person'
    ? personPin(cx, fill, ring, Boolean(input.selected), Boolean(input.live))
    : `<g transform="translate(${(cx - 32).toFixed(1)} ${height - 78})">${object3d(input.kind, Boolean(input.past))}</g>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">`,
    `<g class="event-label" pointer-events="none">`,
    `<rect x="${labelX.toFixed(1)}" y="2" width="${labelWidth.toFixed(1)}" height="22" rx="11" fill="${BRAND.paper}" stroke="${BRAND.ink}" stroke-width="1.5"/>`,
    `<text x="${cx}" y="17" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" fill="${BRAND.ink}">${label}</text>`,
    `</g>`,
    body,
    `</svg>`,
  ].join('');
  return { svg, width, height, anchor: 'bottom' };
}
