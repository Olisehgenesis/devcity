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

/** Ticket, gift, and stall. Each shape includes its own short tail. No pin, circle, or badge. */
function sticker(kind: CityPinKind, fill: string): string {
  const ink = BRAND.ink;
  const paper = BRAND.paper;
  if (kind === 'event') {
    const body = 'M6 10h28a4 4 0 0 1 4 4v5a3.2 3.2 0 0 0 0 6.4V30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V25.4a3.2 3.2 0 0 0 0-6.4V14a4 4 0 0 1 4-4z';
    const tail = 'M16 34h8l-4 25z';
    return [
      `<g fill="${ink}" transform="translate(0 5)"><path d="${body}"/><path d="${tail}"/></g>`,
      `<path d="${body}" fill="${fill}" stroke="${paper}" stroke-width="2.5" stroke-linejoin="round"/>`,
      `<path d="M8 14h24" fill="none" stroke="${paper}" stroke-width="2" stroke-linecap="round"/>`,
      `<path d="${tail}" fill="${fill}" stroke="${paper}" stroke-width="2" stroke-linejoin="round"/>`,
    ].join('');
  }
  if (kind === 'drop') {
    const lid = 'M4 14h32l-3 7H7z';
    const box = 'M8 21h24v14H8z';
    const tail = 'M16 35h8l-4 24z';
    return [
      `<g fill="${ink}" transform="translate(0 5)"><path d="${lid}"/><path d="${box}"/><path d="${tail}"/></g>`,
      `<path d="${box}" fill="${fill}" stroke="${paper}" stroke-width="2.5" stroke-linejoin="round"/>`,
      `<path d="${lid}" fill="${paper}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
      `<path d="M20 14v21" fill="none" stroke="${fill}" stroke-width="2.5"/>`,
      `<path d="M14 14c0-4 3-6 6-3 3-3 6-1 6 3" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
      `<path d="${tail}" fill="${fill}" stroke="${paper}" stroke-width="2" stroke-linejoin="round"/>`,
    ].join('');
  }
  const awning = 'M3 16c4-8 8-8 12 0 4-8 8-8 12 0 4-8 8-8 12 0v6H3z';
  const shop = 'M9 22h22v13H9z';
  const tail = 'M16 35h8l-4 24z';
  return [
    `<g fill="${ink}" transform="translate(0 5)"><path d="${awning}"/><path d="${shop}"/><path d="${tail}"/></g>`,
    `<path d="${shop}" fill="${paper}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
    `<path d="${awning}" fill="${fill}" stroke="${paper}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<path d="M18 26h4v9h-4z" fill="${fill}"/>`,
    `<path d="${tail}" fill="${fill}" stroke="${paper}" stroke-width="2" stroke-linejoin="round"/>`,
  ].join('');
}

/**
 * Map stickers. People stay on the original pin. Events, drops, and places are
 * separate drawings with a short tail whose tip is the bottom-center anchor.
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
  const height = input.kind === 'person' ? 90 : 86;
  const cx = width / 2;
  const labelX = cx - labelWidth / 2;
  const fill = fillFor(input.kind, Boolean(input.past));
  const ring = input.live ? BRAND.accent : BRAND.ink;
  const body = input.kind === 'person'
    ? personPin(cx, fill, ring, Boolean(input.selected), Boolean(input.live))
    : `<g transform="translate(${(cx - 20).toFixed(1)} 26)">${sticker(input.kind, fill)}</g>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">`,
    `<g class="event-label" pointer-events="none">`,
    `<rect x="${labelX.toFixed(1)}" y="2" width="${labelWidth.toFixed(1)}" height="22" rx="11" fill="${BRAND.paper}" stroke="${BRAND.ink}" stroke-width="1.5"/>`,
    `<text x="${cx}" y="17" text-anchor="middle" font-family="Nunito, system-ui, sans-serif" font-size="11" font-weight="800" fill="${BRAND.ink}">${label}</text>`,
    `</g>`,
    body,
    `</svg>`,
  ].join('');
  return { svg, width, height, anchor: 'bottom' };
}
