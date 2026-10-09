'use client';

import { useEffect } from 'react';
import { CityMap } from '@/components/map/CityMap';
import { BottomNav } from '@/components/layout/BottomNav';
import { BottomSheets } from '@/components/layout/BottomSheets';
import { MapControls } from '@/components/map/MapControls';
import { useAppStore } from '@/lib/store';
import { demoMarkers, demoUser } from '@/lib/demo-data';
import { AvatarDisplay } from '@/components/avatar/AvatarComponents';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const { user, mapMarkers, setMapMarkers, currentPosition, setCurrentPosition, isMapReady } = useAppStore();

  useEffect(() => {
    if (mapMarkers.length === 0) {
      setMapMarkers(demoMarkers);
    }
    if (!user) {
      // Demo user for testing
      // In real app, this comes from wallet connection
    }
  }, [mapMarkers, setMapMarkers, user]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        () => {
          // Default to Nairobi (KICC area) for demo
          setCurrentPosition({
            lat: -1.2921,
            lng: 36.8219,
            accuracy: 100,
            timestamp: Date.now(),
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [setCurrentPosition]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      <CityMap
        showUserLocation={true}
        userPosition={currentPosition}
        onMarkerClick={(marker) => {
          useAppStore.getState().setSelectedMarkerId(marker.id);
          useAppStore.getState().setActiveBottomSheet(getSheetType(marker.type) as any);
        }}
        onMapClick={() => {
          useAppStore.getState().setSelectedMarkerId(null);
          useAppStore.getState().setActiveBottomSheet('none');
        }}
      />

      <MapControls />

      {!isMapReady && (
        <div className="absolute top-4 left-4 right-4 z-40 flex justify-center">
          <div className="glass-strong rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            Loading city...
          </div>
        </div>
      )}

      <BottomSheets />

      <BottomNav />

      {user && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <AvatarDisplay
            name={user.username}
            walletAddress={user.walletAddress}
            size="md"
          />
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
              {user.walletAddress}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getSheetType(type: string): 'drop' | 'event' | 'place' | 'quest' | 'person' | 'none' {
  switch (type) {
    case 'drop':
      return 'drop';
    case 'event':
      return 'event';
    case 'place':
      return 'place';
    case 'quest':
      return 'quest';
    case 'person':
      return 'profile' as any;
    default:
      return 'none';
  }
}