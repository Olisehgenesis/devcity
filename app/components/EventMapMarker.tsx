"use client";

type CategoryStyle = { color: string; icon: string };

// Lucide icon path data (matches the lucide-react icons used across the app),
// inlined so the string-based SVG builder stays dependency-free.
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  devcon: { color: "#E45700", icon: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>' },
  "side-event": { color: "#D01265", icon: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>' },
  residency: { color: "#00987F", icon: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  ibw: { color: "#9cbcaf", icon: '<polygon points="13 2 3 14 12 14 11 22 21 12 12 12 13 2"/>' },
  "hacker-house": { color: "#e5b984", icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
  community: { color: "#dfb9a4", icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
};

const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  color: "#e6b34c",
  icon: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

export function eventCategoryStyle(category?: string | null): CategoryStyle {
  if (!category) return DEFAULT_CATEGORY_STYLE;
  return CATEGORY_STYLES[category.trim().toLowerCase()] ?? DEFAULT_CATEGORY_STYLE;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&apos;";
    }
  });
}

function truncateTitle(title: string, max = 18): string {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export type EventMarkerSvgProps = {
  title: string;
  category?: string | null;
  selected?: boolean;
};

/**
 * Builds the inline SVG for an event map marker: a teardrop pin whose tip
 * points at the event's exact coordinates, with a floating label capsule
 * (hidden by default, revealed via CSS when zoomed in or selected).
 */
export function eventMarkerSvg({ title, category, selected = false }: EventMarkerSvgProps): string {
  const { color, icon } = eventCategoryStyle(category);
  const label = escapeXml(truncateTitle(title));
  const labelWidth = Math.min(150, Math.max(56, truncateTitle(title).length * 6.8 + 22));
  const labelX = 22 - labelWidth / 2;
  const selectedAttr = selected ? "true" : "false";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="60" viewBox="0 0 44 60" role="img" aria-hidden="true" data-selected="${selectedAttr}">`,
    `<g class="event-label" pointer-events="none">`,
    `<path d="M22 -6 L22 19" stroke="#1A1028" stroke-width="2" stroke-linecap="round"/>`,
    `<rect x="${labelX.toFixed(1)}" y="-30" width="${labelWidth.toFixed(1)}" height="24" rx="12" fill="#FFF6FA" stroke="#1A1028" stroke-width="1.5"/>`,
    `<text x="22" y="-13.5" text-anchor="middle" font-family="Inter, 'DM Sans', system-ui, sans-serif" font-size="11" font-weight="800" fill="#1A1028" letter-spacing="-0.01em">${label}</text>`,
    `</g>`,
    `<circle class="event-pin-ring" cx="22" cy="32" r="19.5" fill="none" stroke="#1A1028" stroke-width="2" opacity="0"/>`,
    `<path d="M22 58 C 15 47, 6 44, 6 32 A 16 16 0 1 1 38 32 C 38 44, 29 47, 22 58 Z" fill="#FFF6FA" stroke="#1A1028" stroke-width="2" stroke-linejoin="round"/>`,
    `<circle cx="22" cy="32" r="9.5" fill="${color}"/>`,
    `<g transform="translate(15.5 25.5) scale(0.5417)" fill="none" stroke="#1A1028" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">${icon}</g>`,
    `</svg>`,
  ].join("");
}

type EventMapMarkerProps = EventMarkerSvgProps & {
  className?: string;
};

/** Reusable React wrapper around {@link eventMarkerSvg} for non-map contexts. */
export function EventMapMarker({ title, category, selected = false, className = "" }: EventMapMarkerProps) {
  return (
    <span
      className={`event-pin-marker${selected ? " marker-selected" : ""}${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: eventMarkerSvg({ title, category, selected }) }}
    />
  );
}
