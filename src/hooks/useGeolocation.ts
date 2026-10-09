import { useState, useEffect, useCallback, useRef } from 'react';
import type { Position } from '@/types';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface UseGeolocationReturn {
  position: Position | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
  requestPosition: () => void;
  watchPosition: () => void;
  stopWatching: () => void;
}

export function useGeolocation(options: GeolocationOptions = {}): UseGeolocationReturn {
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 0 } = options;
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError({ code: 0, message: 'Geolocation is not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(err);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    requestPosition();
    return () => stopWatching();
  }, [requestPosition, stopWatching]);

  return { position, error, isLoading, requestPosition, watchPosition, stopWatching };
}

export function useGeolocationWatch(options: GeolocationOptions = {}): UseGeolocationReturn {
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 0 } = options;
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError({ code: 0, message: 'Geolocation is not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      setIsLoading(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enableHighAccuracy, timeout, maximumAge]);

  const requestPosition = useCallback(() => {}, []);
  const watchPosition = useCallback(() => {}, []);
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  return { position, error, isLoading, requestPosition, watchPosition, stopWatching };
}

export function useDistance(userPosition: Position | null, targetPosition: Position | null): number | null {
  if (!userPosition || !targetPosition) return null;

  const R = 6371e3;
  const φ1 = (userPosition.lat * Math.PI) / 180;
  const φ2 = (targetPosition.lat * Math.PI) / 180;
  const Δφ = ((targetPosition.lat - userPosition.lat) * Math.PI) / 180;
  const Δλ = ((targetPosition.lng - userPosition.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return '—';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}