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
  kind: 'claim' | 'tip' | 'join';
  text: string;
  at: number;
}

interface CityStore {
  claimed: Record<string, ClaimRecord>;
  tips: TipRecord[];
  activity: ActivityItem[];
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
  reset: () => void;
}

export const useCityStore = create<CityStore>()(
  persist(
    (set) => ({
      claimed: {},
      tips: [],
      activity: [],
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

      reset: () => set({ claimed: {}, tips: [], activity: [], avatarMode: 'dicebear', avatarSeed: '', avatarImageData: null }),
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
