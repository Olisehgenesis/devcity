import { useEffect, useRef } from 'react';
import { useCityStore } from '../lib/city-store';

/**
 * Hook to automatically sync user data to/from server
 * @param intervalMs - Sync interval in milliseconds (default: 60000 = 1 minute)
 */
export function useAutoSync(active = true, intervalMs: number = 60000) {
  const { syncToServer, syncFromServer, autoSyncEnabled, syncStatus } = useCityStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!active || !autoSyncEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial sync on mount
    syncFromServer();

    // Set up periodic sync
    intervalRef.current = setInterval(() => {
      syncToServer();
    }, intervalMs);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, autoSyncEnabled, intervalMs, syncToServer, syncFromServer]);

  return { syncStatus };
}
