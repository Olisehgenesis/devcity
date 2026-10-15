import { useEffect, useRef, useState } from 'react';

export interface PresenceUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
  visibility: string;
  lat: number | null;
  lng: number | null;
  distance: number;
  lastUpdated: string;
}

export interface PresenceStreamData {
  type: 'initial' | 'update' | 'error';
  users?: PresenceUser[];
  message?: string;
}

/**
 * Hook to subscribe to real-time presence updates via Server-Sent Events
 * @param lat - Current latitude
 * @param lng - Current longitude
 * @param radiusKm - Search radius in kilometers (default: 1)
 */
export function useRealtimePresence(
  lat: number | null,
  lng: number | null,
  radiusKm: number = 1
) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!lat || !lng) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new SSE connection
    const url = `/api/presence/stream?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: PresenceStreamData = JSON.parse(event.data);

        if (data.type === 'error') {
          setError(data.message || 'Unknown error');
          return;
        }

        if (data.users) {
          setUsers(data.users);
        }
      } catch (parseError) {
        console.error('Failed to parse SSE message:', parseError);
        setError('Failed to parse server response');
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setConnected(false);
      setError('Connection to presence server failed');
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [lat, lng, radiusKm]);

  return { users, connected, error };
}
