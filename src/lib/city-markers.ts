export const BRAND = {
  primary: '#D01265',
  secondary: '#00987F',
  accent: '#E45700',
  ink: '#1A1028',
  paper: '#FFF6FA',
  muted: '#5C4A62',
} as const;

export type CityPinKind = 'person' | 'place' | 'event' | 'drop';

const GLYPHS: Record<CityPinKind, string> = {
  person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5v-1.2a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1.2"/>',
  place: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z"/>',
  event: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 9.5h16"/>',
  drop: '<path d="M7 11.2 12 8.4l5 2.8-5 2.8-5-2.8z"/><path d="M7 11.2V15l5 2.8V14z"/><path d="M17 11.2V15l-5 2.8V14z"/>',
};

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
  if (kind === 'place') return BRAND.primary;
  return BRAND.accent;
}

/**
 * One map-pin family. The viewBox includes the label and the pin tip, so nothing
 * is drawn outside the SVG. The tip is the bottom-center point for anchor "bottom".
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
  const height = 90;
  const cx = width / 2;
  const labelX = cx - labelWidth / 2;
  const fill = fillFor(input.kind, Boolean(input.past));
  const ring = input.live ? BRAND.accent : BRAND.ink;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">`,
    `<g class="event-label" pointer-events="none">`,
    `<rect x="${labelX.toFixed(1)}" y="2" width="${labelWidth.toFixed(1)}" height="22" rx="11" fill="${BRAND.paper}" stroke="${BRAND.ink}" stroke-width="1.5"/>`,
    `<text x="${cx}" y="17" text-anchor="middle" font-family="Nunito, system-ui, sans-serif" font-size="11" font-weight="800" fill="${BRAND.ink}">${label}</text>`,
    `</g>`,
    `<path d="M${cx} 89 C ${cx - 8} 76, ${cx - 18} 68, ${cx - 18} 54 A 18 18 0 1 1 ${cx + 18} 54 C ${cx + 18} 68, ${cx + 8} 76, ${cx} 89 Z" fill="${BRAND.paper}" stroke="${BRAND.ink}" stroke-width="2" stroke-linejoin="round"/>`,
    `<circle class="event-pin-ring" cx="${cx}" cy="54" r="16" fill="none" stroke="${ring}" stroke-width="2" opacity="${input.selected || input.live ? '1' : '0'}"/>`,
    `<circle cx="${cx}" cy="54" r="10" fill="${fill}"/>`,
    `<g transform="translate(${cx - 8} 46) scale(0.6667)" fill="none" stroke="${BRAND.ink}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[input.kind]}</g>`,
    `</svg>`,
  ].join('');
  return { svg, width, height, anchor: 'bottom' };
}
