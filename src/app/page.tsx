'use client';

import { useEffect } from 'react';
import { CityMap } from '@/components/map/CityMap';
import { BottomNav } from '@/components/layout/BottomNav';
import { BottomSheets } from '@/components/layout/BottomSheets';
import { MapControls } from '@/components/map/MapControls';
import { SocialSheet } from '@/components/social/SocialSheet';
import { StoryViewer } from '@/components/social/StoryViewer';
import { StoriesBar } from '@/components/social/StoriesBar';
import { LoadingOverlay } from '@/components/social/LoadingOverlay';
import { FloatingAvatars } from '@/components/social/FloatingAvatars';
import { PresenceBadge } from '@/components/social/PresenceBadge';
import { useAppStore } from '@/lib/store';
import { demoMarkers, demoUser } from '@/lib/demo-data';
import type { MapMarker } from '@/types';
import { AvatarDisplay } from '@/components/avatar/AvatarComponents';
import { Users } from 'lucide-react';

interface ApiTimetableSlot {
  id: string;
  date: string;
  dayNumber: number | null;
  label: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  title: string | null;
}

interface ApiEvent {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  summary: string | null;
  category: string | null;
  kind: string | null;
  region: string | null;
  location: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  url: string | null;
  timetable: ApiTimetableSlot[];
}

async function loadEventMarkers(): Promise<MapMarker[]> {
  try {
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    const now = Date.now();
    return (json.events as ApiEvent[])
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e) => {
        const startTs = e.startDate ? new Date(`${e.startDate}T${e.startTime || '00:00:00'}Z`).getTime() : now;
        const endTs = e.endDate
          ? new Date(`${e.endDate}T${e.endTime || '23:59:59'}Z`).getTime()
          : startTs;
        const isActive = e.startDate != null && startTs <= now && endTs >= now;
        return {
          id: `event-${e.slug}`,
          type: 'event' as const,
          position: { lat: e.latitude as number, lng: e.longitude as number, timestamp: Date.now() },
          data: {
            eventId: e.id,
            name: e.name,
            startTime: startTs,
            distance: 0,
            isActive,
            slug: e.slug,
            organizer: e.organizer,
            summary: e.summary,
            category: e.category,
            kind: e.kind,
            region: e.region,
            location: e.location,
            online: e.online,
            startDate: e.startDate,
            endDate: e.endDate,
            startTimeStr: e.startTime,
            endTimeStr: e.endTime,
            url: e.url,
            imageUrl: e.imageUrl,
            latitude: e.latitude,
            longitude: e.longitude,
            timetable: e.timetable,
          },
        };
      });
  } catch {
    return [];
  }
}

export default function HomePage() {
  const {
    user,
    mapMarkers,
    setMapMarkers,
    currentPosition,
    setCurrentPosition,
    isMapReady,
    activeStory,
    setActiveStory,
    setActiveBottomSheet,
    presenceStatus,
    initSocial,
  } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    void loadEventMarkers().then((eventMarkers) => {
      if (cancelled || eventMarkers.length === 0) return;
      // Real krew3 events replace the demo Nairobi events; keep other demo markers.
      const nonEventDemo = demoMarkers.filter((m) => m.type !== 'event');
      setMapMarkers([...eventMarkers, ...nonEventDemo]);
    });
    return () => {
      cancelled = true;
    };
    if (!user) {
      // Demo user for testing
      // In real app, this comes from wallet connection
    }
    void initSocial();
  }, [setMapMarkers, user, initSocial]);

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
          // Default to Mumbai (Fort area) — Devcon 8 host city
          setCurrentPosition({
            lat: 19.076,
            lng: 72.8356,
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
      <h1 className="sr-only">DEVCITY26 — A Living Onchain City</h1>
      <FloatingAvatars />

      <main className="relative h-full w-full">
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <StoriesBar onOpen={(story) => setActiveStory(story)} />
        </div>

        <BottomSheets />

        <SocialSheet />

        <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />

        <BottomNav />

        {user && (
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            <button
              onClick={() => setActiveBottomSheet('social')}
              className="glass-strong rounded-xl p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open social"
              title="Around the city"
            >
              <Users className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="glass-strong rounded-xl px-3 py-2 flex items-center gap-2">
              <div className="relative">
                <AvatarDisplay
                  name={user.username}
                  walletAddress={user.walletAddress}
                  size="md"
                />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceBadge status={presenceStatus} />
                </span>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                  {user.walletAddress}
                </p>
              </div>
            </div>
          </div>
        )}

        <LoadingOverlay ready={isMapReady} />
      </main>
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