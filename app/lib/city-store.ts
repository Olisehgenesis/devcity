import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { bidirectionalSync, type SyncData, type ServerSyncResponse } from '@/lib/sync';

export type Visibility = 'invisible' | 'event-only' | 'approximate' | 'visible';
export type ProfilePrivacy = 'public' | 'private';
export type PresenceStatus = 'online' | 'away' | 'offline';
export type AvatarMode = 'dicebear' | 'initials' | 'upload';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface ClaimRecord {
  dropId: string;
  dropName: string;
  tokenSymbol: string;
  amount: string;
  at: number;
  txHash?: string;
}

export interface TipRecord {
  toName: string;
  tokenSymbol: string;
  amount: string;
  at: number;
}

export interface ActivityItem {
  id: string;
  kind: 'claim' | 'tip' | 'join' | 'event';
  text: string;
  at: number;
}

export interface SavedEvent {
  id: string;
  name: string;
  organizer: string;
  location: string | null;
  startDate: string | null;
  url: string | null;
  attendance: 'going' | 'attended';
  savedAt: number;
}

interface CityStore {
  claimed: Record<string, ClaimRecord>;
  tips: TipRecord[];
  activity: ActivityItem[];
  savedEvents: SavedEvent[];
  visibility: Visibility;
  profilePrivacy: ProfilePrivacy;
  presenceStatus: PresenceStatus;
  presenceUntil: number | null;
  avatarMode: AvatarMode;
  avatarSeed: string;
  avatarImageData: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  autoSyncEnabled: boolean;
  claim: (dropId: string, dropName: string, tokenSymbol: string, amount: string, txHash: string) => void;
  sendTip: (toName: string, tokenSymbol: string, amount: string) => void;
  setVisibility: (v: Visibility) => void;
  setProfilePrivacy: (privacy: ProfilePrivacy) => void;
  setPresence: (status: PresenceStatus, durationMs?: number | null) => void;
  setAvatarMode: (mode: AvatarMode) => void;
  setAvatarImageData: (data: string) => void;
  shuffleAvatar: () => void;
  saveEvent: (event: Omit<SavedEvent, 'attendance' | 'savedAt'>) => void;
  markEventAttended: (eventId: string) => void;
  removeSavedEvent: (eventId: string) => void;
  reset: () => void;
  syncToServer: () => Promise<void>;
  syncFromServer: () => Promise<void>;
  setAutoSync: (enabled: boolean) => void;
}

export const useCityStore = create<CityStore>()(
  persist(
    (set, get) => ({
      claimed: {},
      tips: [],
      activity: [],
      savedEvents: [],
      visibility: 'approximate',
      profilePrivacy: 'public',
      presenceStatus: 'online',
      presenceUntil: null,
      avatarMode: 'dicebear',
      avatarSeed: '',
      avatarImageData: null,
      syncStatus: 'idle',
      lastSyncedAt: null,
      autoSyncEnabled: true,

      claim: (dropId, dropName, tokenSymbol, amount, txHash) =>
        set((state) => {
          if (state.claimed[dropId]?.txHash) return state;
          const record: ClaimRecord = { dropId, dropName, tokenSymbol, amount, at: Date.now(), txHash };
          return {
            claimed: { ...state.claimed, [dropId]: record },
            activity: [
              { id: `a-${Date.now()}`, kind: 'claim' as const, text: `Claimed ${amount} ${tokenSymbol}`, at: Date.now() },
              ...state.activity,
            ].slice(0, 30),
          };
        }),

      sendTip: (toName, tokenSymbol, amount) =>
        set((state) => ({
          tips: [{ toName, tokenSymbol, amount, at: Date.now() }, ...state.tips].slice(0, 30),
          activity: [
            { id: `a-${Date.now()}`, kind: 'tip' as const, text: `Tipped ${amount} ${tokenSymbol} to ${toName}`, at: Date.now() },
            ...state.activity,
          ].slice(0, 30),
        })),

      setVisibility: (visibility) => set({ visibility }),

      setProfilePrivacy: (profilePrivacy) => set({ profilePrivacy }),

      setPresence: (presenceStatus, durationMs = null) => set({
        presenceStatus,
        presenceUntil: durationMs ? Date.now() + durationMs : null,
      }),

      setAvatarMode: (avatarMode) => set({ avatarMode }),

      setAvatarImageData: (avatarImageData) => set({ avatarMode: 'upload', avatarImageData }),

      shuffleAvatar: () => set({ avatarMode: 'dicebear', avatarSeed: crypto.randomUUID() }),

      saveEvent: (event) =>
        set((state) => {
          if (state.savedEvents.some((saved) => saved.id === event.id)) return state;
          return {
            savedEvents: [{ ...event, attendance: 'going', savedAt: Date.now() }, ...state.savedEvents],
            activity: [
              { id: `a-${Date.now()}`, kind: 'event' as const, text: `Going to ${event.name}`, at: Date.now() },
              ...state.activity,
            ].slice(0, 30),
          };
        }),

      markEventAttended: (eventId) =>
        set((state) => ({
          savedEvents: state.savedEvents.map((event) =>
            event.id === eventId ? { ...event, attendance: 'attended' } : event,
          ),
        })),

      removeSavedEvent: (eventId) =>
        set((state) => ({ savedEvents: state.savedEvents.filter((event) => event.id !== eventId) })),

      reset: () => set({ claimed: {}, tips: [], activity: [], savedEvents: [], avatarMode: 'dicebear', avatarSeed: '', avatarImageData: null }),

      syncToServer: async () => {
        const state = get();
        if (!state.autoSyncEnabled) return;

        set({ syncStatus: 'syncing' });

        try {
          const syncData: SyncData = {
            savedEvents: state.savedEvents,
            activity: state.activity.map((a) => ({
              id: a.id,
              kind: a.kind,
              text: a.text,
              refId: a.kind === 'claim' || a.kind === 'tip' ? undefined : a.id,
              timestamp: new Date(a.at).toISOString(),
            })),
            preferences: {
              visibility: state.visibility,
              profilePrivacy: state.profilePrivacy,
              avatarMode: state.avatarMode,
            },
          };

          const result = await bidirectionalSync(syncData);

          // Merge server data back to local
          set((state) => ({
            activity: result.activity.map((a) => ({
              id: a.id,
              kind: a.kind as any,
              text: a.text,
              refId: a.refId,
              at: new Date(a.timestamp).getTime(),
            })),
            syncStatus: 'success',
            lastSyncedAt: Date.now(),
          }));
        } catch (error) {
          console.error('Sync failed:', error);
          set({ syncStatus: 'error' });
        }
      },

      syncFromServer: async () => {
        const state = get();
        if (!state.autoSyncEnabled) return;

        set({ syncStatus: 'syncing' });

        try {
          const { syncFromServer } = await import('@/lib/sync');
          const result = await syncFromServer();

          if (result.settings) {
            set((state) => ({
              savedEvents: result.settings?.savedEvents || state.savedEvents,
              activity: result.activity.map((a) => ({
                id: a.id,
                kind: a.kind as any,
                text: a.text,
                refId: a.refId,
                at: new Date(a.timestamp).getTime(),
              })),
              syncStatus: 'success',
              lastSyncedAt: Date.now(),
            }));
          }
        } catch (error) {
          console.error('Sync from server failed:', error);
          set({ syncStatus: 'error' });
        }
      },

      setAutoSync: (enabled) => set({ autoSyncEnabled: enabled }),
    }),
    {
      name: 'devcity-city',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
