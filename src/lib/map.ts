import type { Position } from '@/types';

export interface MapViewport {
  center: Position;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const DEFAULT_MAP_CENTER: Position = {
  lat: -1.2921,
  lng: 36.8219,
  timestamp: Date.now(),
};

export const DEFAULT_MAP_ZOOM = 15;

export const MAP_STYLES = {
  light: 'https://api.maptiler.com/maps/streets/style.json?key={key}',
  dark: 'https://api.maptiler.com/maps/dark/style.json?key={key}',
  satellite: 'https://api.maptiler.com/maps/satellite/style.json?key={key}',
  hybrid: 'https://api.maptiler.com/maps/hybrid/style.json?key={key}',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

export const MARKER_ICONS = {
  person: '👤',
  drop: '🎁',
  event: '🎉',
  place: '📍',
  quest: '🏆',
  market: '💱',
} as const;

export const MARKER_COLORS = {
  person: '#3b82f6',
  drop: '#22c55e',
  event: '#f97316',
  place: '#8b5cf6',
  quest: '#eab308',
  market: '#ec4899',
} as const;

export function getMapStyleUrl(style: MapStyleKey, apiKey: string): string {
  return MAP_STYLES[style].replace('{key}', apiKey);
}

export function calculateZoomForRadius(radiusMeters: number): number {
  if (radiusMeters <= 100) return 18;
  if (radiusMeters <= 500) return 16;
  if (radiusMeters <= 1000) return 15;
  if (radiusMeters <= 5000) return 13;
  if (radiusMeters <= 10000) return 12;
  return 11;
}

export function fitBoundsToRadius(center: Position, radiusMeters: number): MapBounds {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

export function getViewportFromMarkers(
  markers: { position: Position }[],
  padding = 50
): { center: Position; zoom: number } | null {
  if (markers.length === 0) return null;
  if (markers.length === 1) {
    return { center: markers[0].position, zoom: 16 };
  }

  let minLat = markers[0].position.lat;
  let maxLat = markers[0].position.lat;
  let minLng = markers[0].position.lng;
  let maxLng = markers[0].position.lng;

  for (const marker of markers) {
    minLat = Math.min(minLat, marker.position.lat);
    maxLat = Math.max(maxLat, marker.position.lat);
    minLng = Math.min(minLng, marker.position.lng);
    maxLng = Math.max(maxLng, marker.position.lng);
  }

  const center: Position = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    timestamp: Date.now(),
  };

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const maxRange = Math.max(latRange, lngRange);

  let zoom = 18;
  if (maxRange > 0.01) zoom = 14;
  else if (maxRange > 0.005) zoom = 15;
  else if (maxRange > 0.001) zoom = 16;
  else if (maxRange > 0.0005) zoom = 17;

  return { center, zoom };
}

export function interpolatePosition(
  start: Position,
  end: Position,
  progress: number
): Position {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
    timestamp: Date.now(),
  };
}

export function addJitter(position: Position, maxMeters = 50): Position {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * maxMeters;
  const latOffset = (distance * Math.cos(angle)) / 111000;
  const lngOffset = (distance * Math.sin(angle)) / (111000 * Math.cos((position.lat * Math.PI) / 180));

  return {
    lat: position.lat + latOffset,
    lng: position.lng + lngOffset,
    timestamp: Date.now(),
  };
}

export function snapToGeohashCell(position: Position, precision = 7): Position {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;

  for (let i = 0; i < precision; i++) {
    const midLat = (latMin + latMax) / 2;
    const midLng = (lngMin + lngMax) / 2;

    if (even) {
      if (position.lng > midLng) lngMin = midLng;
      else lngMax = midLng;
    } else {
      if (position.lat > midLat) latMin = midLat;
      else latMax = midLat;
    }
    even = !even;
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    timestamp: Date.now(),
  };
}

export function getApproximatePosition(
  position: Position,
  options: { mode: 'approximate' | 'event-only' | 'friends-only' | 'invisible'; eventCenter?: Position; eventRadius?: number } = { mode: 'approximate' }
): Position | null {
  switch (options.mode) {
    case 'invisible':
      return null;
    case 'event-only':
      if (options.eventCenter && options.eventRadius) {
        const distance = calculateDistance(
          position.lat,
          position.lng,
          options.eventCenter.lat,
          options.eventCenter.lng
        );
        if (distance <= options.eventRadius) {
          return snapToGeohashCell(position, 6);
        }
        return null;
      }
      return snapToGeohashCell(position, 6);
    case 'friends-only':
      return snapToGeohashCell(position, 5);
    case 'approximate':
    default:
      return snapToGeohashCell(position, 6);
  }
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function createMapMarkerElement(
  type: keyof typeof MARKER_ICONS,
  options: { size?: number; color?: string; pulse?: boolean } = {}
): HTMLElement {
  const { size = 40, color = MARKER_COLORS[type], pulse = false } = options;
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.backgroundColor = color;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = `${size * 0.5}px`;
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  el.style.border = '3px solid white';
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 0.2s ease';
  el.innerHTML = MARKER_ICONS[type];

  if (pulse) {
    el.style.animation = 'pulse 2s infinite';
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 ${color}80; }
        70% { box-shadow: 0 0 0 10px ${color}00; }
        100% { box-shadow: 0 0 0 0 ${color}00; }
      }
    `;
    document.head.appendChild(style);
  }

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.2)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });

  return el;
}

export const MAP_CONTROLS = {
  zoom: true,
  rotation: true,
  pitch: true,
  fullscreen: true,
  geolocate: true,
} as const;