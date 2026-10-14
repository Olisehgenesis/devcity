import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Visibility = 'invisible' | 'event-only' | 'approximate' | 'visible';
export type ProfilePrivacy = 'public' | 'private';
export type PresenceStatus = 'online' | 'away' | 'offline';
export type AvatarMode = 'dicebear' | 'initials' | 'upload';

export interface ClaimRecord {
  dropId: string;
  dropName: string;
  tokenSymbol: string;
  amount: string;
  at: number;
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
  claim: (dropId: string, dropName: string, tokenSymbol: string, amount: string) => void;
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
}

export const useCityStore = create<CityStore>()(
  persist(
    (set) => ({
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

      claim: (dropId, dropName, tokenSymbol, amount) =>
        set((state) => {
          if (state.claimed[dropId]) return state;
          const record: ClaimRecord = { dropId, dropName, tokenSymbol, amount, at: Date.now() };
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
