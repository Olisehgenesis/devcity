import { authClient } from './auth-client';

export interface SyncData {
  savedEvents?: Array<{
    id: string;
    attendance: 'going' | 'attended';
    startDate: string | null;
    location?: string | null;
    name: string;
    url?: string | null;
  }>;
  activity?: Array<{
    id?: string;
    kind: string;
    text: string;
    refId?: string;
    timestamp: string;
  }>;
  preferences?: Record<string, any>;
}

export interface ServerSyncResponse {
  success: boolean;
  settings: {
    savedEvents: any[];
    preferences: any;
    lastSyncedAt: string;
  } | null;
  activity: Array<{
    id: string;
    kind: string;
    text: string;
    refId?: string;
    timestamp: string;
  }>;
  lastSyncedAt: string;
}

/**
 * Sync local data to server
 */
export async function syncToServer(data: SyncData): Promise<ServerSyncResponse> {
  try {
    const session = await authClient.getSession();
    const user = (session?.data as { user?: { id: string } } | null)?.user;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get wallet address from local storage or session
    const { listLocalWallets } = await import('./keystore');
    const wallets = await listLocalWallets();
    const userAddress = wallets[0]?.address;

    if (!userAddress) {
      throw new Error('No wallet address found');
    }

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Sync to server failed:', error);
    throw error;
  }
}

/**
 * Fetch data from server
 */
export async function syncFromServer(): Promise<ServerSyncResponse> {
  try {
    const session = await authClient.getSession();
    const user = (session?.data as { user?: { id: string } } | null)?.user;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { listLocalWallets } = await import('./keystore');
    const wallets = await listLocalWallets();
    const userAddress = wallets[0]?.address;

    if (!userAddress) {
      throw new Error('No wallet address found');
    }

    const response = await fetch(`/api/sync?userAddress=${userAddress}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Sync from server failed:', error);
    throw error;
  }
}

/**
 * Bidirectional sync - merge local and server data
 */
export async function bidirectionalSync(localData: SyncData): Promise<ServerSyncResponse> {
  try {
    // First, sync local data to server
    const serverResponse = await syncToServer(localData);

    // Merge server data back to local
    // Priority: server > local for most data
    const mergedActivity = mergeActivity(localData.activity || [], serverResponse.activity || []);

    return {
      ...serverResponse,
      activity: mergedActivity,
    };
  } catch (error) {
    console.error('Bidirectional sync failed:', error);
    throw error;
  }
}

/**
 * Merge local and server activity, deduplicating by id
 */
function mergeActivity(
  localActivity: Array<{ id?: string; kind: string; text: string; refId?: string; timestamp: string }>,
  serverActivity: Array<{ id: string; kind: string; text: string; refId?: string; timestamp: string }>
): Array<{ id: string; kind: string; text: string; refId?: string; timestamp: string }> {
  const activityMap = new Map<string, any>();

  // Add server activity first (server has priority)
  for (const item of serverActivity) {
    activityMap.set(item.id, item);
  }

  // Add local activity that doesn't exist on server
  for (const item of localActivity) {
    if (item.id && !activityMap.has(item.id)) {
      activityMap.set(item.id, item);
    }
  }

  // Convert back to array and sort by timestamp
  return Array.from(activityMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Auto-sync on interval
 */
export function setupAutoSync(
  localData: () => SyncData,
  onSyncComplete: (data: ServerSyncResponse) => void,
  intervalMs: number = 60000 // 1 minute default
): () => void {
  const intervalId = setInterval(async () => {
    try {
      const data = localData();
      const result = await bidirectionalSync(data);
      onSyncComplete(result);
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
