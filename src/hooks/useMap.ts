import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Position, MapMarker } from '@/types';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MARKER_ICONS, MARKER_COLORS, createMapMarkerElement } from '@/lib/map';

interface UseMapOptions {
  container: HTMLDivElement | null;
  center?: Position;
  zoom?: number;
  style?: string;
  onLoad?: (map: maplibregl.Map) => void;
  onMove?: (viewport: any) => void;
  onClick?: (position: Position) => void;
  onMarkerClick?: (marker: MapMarker) => void;
}

interface UseMapReturn {
  map: maplibregl.Map | null;
  addMarker: (marker: MapMarker) => maplibregl.Marker;
  removeMarker: (markerId: string) => void;
  updateMarker: (markerId: string, position: Position) => void;
  flyTo: (position: Position, zoom?: number) => void;
  fitBounds: (markers: MapMarker[], padding?: number) => void;
  getViewport: () => any | null;
  setStyle: (style: string) => void;
}

export function useMap(options: UseMapOptions): UseMapReturn {
  const {
    container,
    center = DEFAULT_MAP_CENTER,
    zoom = DEFAULT_MAP_ZOOM,
    style = 'https://api.maptiler.com/maps/streets/style.json?key=demo',
    onLoad,
    onMove,
    onClick,
    onMarkerClick,
  } = options;

  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const onLoadRef = useRef(onLoad);
  const onMoveRef = useRef(onMove);
  const onClickRef = useRef(onClick);
  const onMarkerClickRef = useRef(onMarkerClick);

  onLoadRef.current = onLoad;
  onMoveRef.current = onMove;
  onClickRef.current = onClick;
  onMarkerClickRef.current = onMarkerClick;

  useEffect(() => {
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style,
      center: [center.lng, center.lat],
      zoom,
      pitch: 0,
      bearing: 0,
      
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    map.on('load', () => {
      setIsLoaded(true);
      onLoadRef.current?.(map);
    });

    map.on('moveend', () => {
      const viewport = getViewport(map);
      onMoveRef.current?.(viewport);
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng, timestamp: Date.now() });
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [container, style, center, zoom]);

  const getViewport = useCallback((map: maplibregl.Map): any => {
    const center = map.getCenter();
    return {
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  }, []);

  const addMarker = useCallback(
    (markerData: MapMarker): maplibregl.Marker => {
      if (!mapRef.current) throw new Error('Map not initialized');

      const el = createMapMarkerElement(markerData.type, {
        pulse: markerData.type === 'drop',
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([markerData.position.lng, markerData.position.lat])
        .addTo(mapRef.current);

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClickRef.current?.(markerData);
      });

      markersRef.current.set(markerData.id, marker);
      return marker;
    },
    []
  );

  const removeMarker = useCallback((markerId: string) => {
    const marker = markersRef.current.get(markerId);
    if (marker) {
      marker.remove();
      markersRef.current.delete(markerId);
    }
  }, []);

  const updateMarker = useCallback((markerId: string, position: Position) => {
    const marker = markersRef.current.get(markerId);
    if (marker) {
      marker.setLngLat([position.lng, position.lat]);
    }
  }, []);

  const flyTo = useCallback((position: Position, zoomLevel?: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [position.lng, position.lat],
      zoom: zoomLevel ?? mapRef.current.getZoom(),
      essential: true,
    });
  }, []);

  const fitBounds = useCallback(
    (markers: MapMarker[], padding = 50) => {
      if (!mapRef.current || markers.length === 0) return;

      const bounds = new maplibregl.LngLatBounds();
      markers.forEach((m) => bounds.extend([m.position.lng, m.position.lat]));

      mapRef.current.fitBounds(bounds, { padding, maxZoom: 18 });
    },
    []
  );

  const getViewportCurrent = useCallback((): any | null => {
    if (!mapRef.current) return null;
    return getViewport(mapRef.current);
  }, [getViewport]);

  const setStyle = useCallback((newStyle: string) => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(newStyle);
  }, []);

  return {
    map: mapRef.current,
    addMarker,
    removeMarker,
    updateMarker,
    flyTo,
    fitBounds,
    getViewport: getViewportCurrent,
    setStyle,
  };
}

export function useMapMarkers(map: maplibregl.Map | null, markers: MapMarker[], onMarkerClick?: (marker: MapMarker) => void) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!map) return;

    const currentIds = new Set(markers.map((m) => m.id));
    const existingIds = new Set(markersRef.current.keys());

    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const marker = markersRef.current.get(id);
        marker?.remove();
        markersRef.current.delete(id);
      }
    });

    markers.forEach((markerData) => {
      let marker = markersRef.current.get(markerData.id);

      if (!marker) {
        const el = createMapMarkerElement(markerData.type, {
          pulse: markerData.type === 'drop',
        });

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([markerData.position.lng, markerData.position.lat])
          .addTo(map);

        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick?.(markerData);
        });

        markersRef.current.set(markerData.id, marker);
      } else {
        marker.setLngLat([markerData.position.lng, markerData.position.lat]);
      }
    });
  }, [map, markers, onMarkerClick]);

  return markersRef.current;
}