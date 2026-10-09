'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMap, useMapMarkers } from '@/hooks/useMap';
import { useAppStore } from '@/lib/store';
import type { MapMarker, Position } from '@/types';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MARKER_ICONS, MARKER_COLORS, createMapMarkerElement } from '@/lib/map';
import { cn } from '@/lib/utils';

interface CityMapProps {
  className?: string;
  style?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (position: Position) => void;
  showUserLocation?: boolean;
  userPosition?: Position | null;
}

export function CityMap({
  className,
  style = 'https://api.maptiler.com/maps/streets/style.json?key=demo',
  onMarkerClick,
  onMapClick,
  showUserLocation = true,
  userPosition,
}: CityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { map, addMarker, removeMarker, flyTo, fitBounds, getViewport } = useMap({
    container: mapContainerRef.current,
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
    style,
    onLoad: (map) => {
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      if (showUserLocation) {
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            
          }),
          'top-right'
        );
      }
    },
    onMarkerClick,
    onClick: onMapClick,
  });

  const markers = useAppStore((state) => state.mapMarkers);
  const selectedMarkerId = useAppStore((state) => state.selectedMarkerId);
  const setSelectedMarkerId = useAppStore((state) => state.setSelectedMarkerId);
  const setMapViewport = useAppStore((state) => state.setMapViewport);
  const setMapReady = useAppStore((state) => state.setMapReady);
  const [mapLoaded, setMapLoaded] = useState(false);

  useMapMarkers(map, markers, onMarkerClick);

  useEffect(() => {
    if (!map) return;

    const handleMoveEnd = () => {
      const viewport = getViewport();
      if (viewport) {
        setMapViewport(viewport);
      }
    };

    map.on('moveend', handleMoveEnd);
    return () => { map.off('moveend', handleMoveEnd); };
  }, [map, getViewport, setMapViewport]);

  useEffect(() => {
    if (userPosition && map) {
      const userMarkerId = 'user-location';
      const existingEl = document.getElementById(userMarkerId);
      let marker: maplibregl.Marker | null = null;

      if (!existingEl) {
        const el = document.createElement('div');
        el.id = userMarkerId;
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#3b82f6';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 12px rgba(59,130,246,0.4), 0 0 0 4px rgba(59,130,246,0.15)';
        el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.animation = 'userPulse 2s ease-in-out infinite';

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([userPosition.lng, userPosition.lat])
          .addTo(map);
      } else {
        marker = (existingEl as any).__maplibregl_marker || null;
        if (marker) {
          marker.setLngLat([userPosition.lng, userPosition.lat]);
        }
      }
    }
  }, [map, userPosition]);

  useEffect(() => {
    if (map) {
      setMapReady(true);
      setMapLoaded(true);
    }
  }, [map, setMapReady]);

  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      setSelectedMarkerId(marker.id);
      onMarkerClick?.(marker);
    },
    [setSelectedMarkerId, onMarkerClick]
  );

  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!map) return;
      const lngLat = map.unproject([e.clientX, e.clientY]);
      onMapClick?.({ lat: lngLat.lat, lng: lngLat.lng, timestamp: Date.now() });
      setSelectedMarkerId(null);
    },
    [map, onMapClick, setSelectedMarkerId]
  );

  return (
    <div
      ref={mapContainerRef}
      className={cn('relative w-full h-full rounded-2xl overflow-hidden', className)}
      onClick={handleMapClick}
      style={{ minHeight: '400px' }}
    >
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse" />
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse opacity-30" style={{ animationDelay: '0.2s' }} />
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse opacity-15" style={{ animationDelay: '0.4s' }} />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading city...</p>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes userPulse {
          0%, 100% { 
            box-shadow: 0 2px 12px rgba(59,130,246,0.4), 0 0 0 4px rgba(59,130,246,0.15);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 4px 20px rgba(59,130,246,0.6), 0 0 0 8px rgba(59,130,246,0.1);
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

export function MapMarkerCluster({ markers, onClick }: { markers: MapMarker[]; onClick?: (marker: MapMarker) => void }) {
  return null;
}