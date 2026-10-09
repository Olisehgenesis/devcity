import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Token, Drop, Event, Place, Quest, Position, VisibilityMode, MapMarker } from '@/types';

// Social & Claims Types
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
  kind: 'claim' | 'tip' | 'join' | 'broadcast';
  text: string;
  at: number;
}

export interface BroadcastComment {
  id: string;
  text: string;
  at: number;
}

export interface Broadcast {
  id: string;
  text: string;
  at: number;
  likes: number;
  liked: boolean;
  comments: BroadcastComment[];
}

export interface Story {
  id: string;
  username: string;
  avatarUrl: string;
  content: string;
  timestamp: number;
  expiresAt: number;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;

  tokens: Token[];
  setTokens: (tokens: Token[]) => void;
  addToken: (token: Token) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;

  drops: Drop[];
  setDrops: (drops: Drop[]) => void;
  addDrop: (drop: Drop) => void;
  updateDrop: (id: string, updates: Partial<Drop>) => void;

  events: Event[];
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;

  places: Place[];
  setPlaces: (places: Place[]) => void;
  addPlace: (place: Place) => void;

  quests: Quest[];
  setQuests: (quests: Quest[]) => void;
  addQuest: (quest: Quest) => void;
  updateQuest: (id: string, updates: Partial<Quest>) => void;

  mapMarkers: MapMarker[];
  setMapMarkers: (markers: MapMarker[]) => void;
  addMapMarker: (marker: MapMarker) => void;
  removeMapMarker: (id: string) => void;

  currentPosition: Position | null;
  setCurrentPosition: (position: Position | null) => void;

  mapViewport: {
    center: Position;
    zoom: number;
    bearing: number;
    pitch: number;
  };
  setMapViewport: (viewport: Partial<AppState['mapViewport']>) => void;

  visibilityMode: VisibilityMode;
  setVisibilityMode: (mode: VisibilityMode) => void;

  isMapReady: boolean;
  setMapReady: (ready: boolean) => void;

  selectedMarkerId: string | null;
  setSelectedMarkerId: (id: string | null) => void;

  activeBottomSheet: 'none' | 'profile' | 'drop' | 'event' | 'place' | 'quest' | 'token' | 'create-token' | 'create-drop' | 'wallet' | 'social' | 'chat' | 'people';
  setActiveBottomSheet: (sheet: AppState['activeBottomSheet']) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  notifications: Array<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }>;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;

  // Social & Claims
  claimed: Record<string, ClaimRecord>;
  claim: (dropId: string, dropName: string, tokenSymbol: string, amount: string) => void;

  tips: TipRecord[];
  sendTip: (toName: string, tokenSymbol: string, amount: string) => void;

  activity: ActivityItem[];

  broadcasts: Broadcast[];
  addBroadcast: (text: string) => void;
  toggleBroadcastLike: (id: string) => void;
  addBroadcastComment: (id: string, text: string) => void;

  stories: Story[];
  setStories: (stories: Story[]) => void;
  addStory: (story: Story) => void;

  // Profile & Presence
  visibility: Visibility;
  setVisibility: (v: Visibility) => void;

  profilePrivacy: ProfilePrivacy;
  setProfilePrivacy: (privacy: ProfilePrivacy) => void;

  presenceStatus: PresenceStatus;
  presenceUntil: number | null;
  setPresence: (status: PresenceStatus, durationMs?: number | null) => void;

  avatarMode: AvatarMode;
  avatarSeed: string;
  avatarImageData: string | null;
  setAvatarMode: (mode: AvatarMode) => void;
  setAvatarImageData: (data: string) => void;
  shuffleAvatar: () => void;

  clearAll: () => void;
}

const DEFAULT_VIEWPORT = {
  center: { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
  zoom: 15,
  bearing: 0,
  pitch: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      tokens: [],
      setTokens: (tokens) => set({ tokens }),
      addToken: (token) => set((state) => ({ tokens: [...state.tokens, token] })),
      updateToken: (id, updates) =>
        set((state) => ({
          tokens: state.tokens.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      drops: [],
      setDrops: (drops) => set({ drops }),
      addDrop: (drop) => set((state) => ({ drops: [...state.drops, drop] })),
      updateDrop: (id, updates) =>
        set((state) => ({
          drops: state.drops.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        })),

      events: [],
      setEvents: (events) => set({ events }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),

      places: [],
      setPlaces: (places) => set({ places }),
      addPlace: (place) => set((state) => ({ places: [...state.places, place] })),

      quests: [],
      setQuests: (quests) => set({ quests }),
      addQuest: (quest) => set((state) => ({ quests: [...state.quests, quest] })),
      updateQuest: (id, updates) =>
        set((state) => ({
          quests: state.quests.map((q) => (q.id === id ? { ...q, ...updates } : q)),
        })),

      mapMarkers: [],
      setMapMarkers: (markers) => set({ mapMarkers: markers }),
      addMapMarker: (marker) => set((state) => ({ mapMarkers: [...state.mapMarkers, marker] })),
      removeMapMarker: (id) =>
        set((state) => ({ mapMarkers: state.mapMarkers.filter((m) => m.id !== id) })),

      currentPosition: null,
      setCurrentPosition: (position) => set({ currentPosition: position }),

      mapViewport: DEFAULT_VIEWPORT,
      setMapViewport: (viewport) =>
        set((state) => ({ mapViewport: { ...state.mapViewport, ...viewport } })),

      visibilityMode: 'approximate',
      setVisibilityMode: (mode) => set({ visibilityMode: mode }),

      isMapReady: false,
      setMapReady: (ready) => set({ isMapReady: ready }),

      selectedMarkerId: null,
      setSelectedMarkerId: (id) => set({ selectedMarkerId: id }),

      activeBottomSheet: 'none',
      setActiveBottomSheet: (sheet) => set({ activeBottomSheet: sheet }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id: `notif-${Date.now()}` }],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // Social & Claims
      claimed: {},
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

      tips: [],
      sendTip: (toName, tokenSymbol, amount) =>
        set((state) => ({
          tips: [{ toName, tokenSymbol, amount, at: Date.now() }, ...state.tips].slice(0, 30),
          activity: [
            { id: `a-${Date.now()}`, kind: 'tip' as const, text: `Tipped ${amount} ${tokenSymbol} to ${toName}`, at: Date.now() },
            ...state.activity,
          ].slice(0, 30),
        })),

      activity: [],

      broadcasts: [],
      addBroadcast: (text) => set((state) => {
        const trimmed = text.trim().slice(0, 240);
        if (!trimmed) return state;
        const at = Date.now();
        return {
          broadcasts: [{ id: `broadcast-${at}`, text: trimmed, at, likes: 0, liked: false, comments: [] }, ...state.broadcasts].slice(0, 40),
          activity: [{ id: `broadcast-activity-${at}`, kind: 'broadcast' as const, text: `You shared: ${trimmed}`, at }, ...state.activity].slice(0, 30),
        };
      }),
      toggleBroadcastLike: (id) => set((state) => ({
        broadcasts: state.broadcasts.map((broadcast) => broadcast.id === id
          ? { ...broadcast, liked: !broadcast.liked, likes: Math.max(0, broadcast.likes + (broadcast.liked ? -1 : 1)) }
          : broadcast),
      })),
      addBroadcastComment: (id, text) => set((state) => {
        const trimmed = text.trim().slice(0, 240);
        if (!trimmed) return state;
        return {
          broadcasts: state.broadcasts.map((broadcast) => broadcast.id === id
            ? { ...broadcast, comments: [...broadcast.comments, { id: `comment-${Date.now()}`, text: trimmed, at: Date.now() }] }
            : broadcast),
        };
      }),

      stories: [],
      setStories: (stories) => set({ stories }),
      addStory: (story) => set((state) => ({ stories: [...state.stories, story] })),

      // Profile & Presence
      visibility: 'approximate',
      setVisibility: (visibility) => set({ visibility }),

      profilePrivacy: 'public',
      setProfilePrivacy: (profilePrivacy) => set({ profilePrivacy }),

      presenceStatus: 'online',
      presenceUntil: null,
      setPresence: (presenceStatus, durationMs = null) => set({
        presenceStatus,
        presenceUntil: durationMs ? Date.now() + durationMs : null,
      }),

      avatarMode: 'dicebear',
      avatarSeed: '',
      avatarImageData: null,
      setAvatarMode: (avatarMode) => set({ avatarMode }),
      setAvatarImageData: (avatarImageData) => set({ avatarMode: 'upload', avatarImageData }),
      shuffleAvatar: () => set({ avatarMode: 'dicebear', avatarSeed: crypto.randomUUID() }),

      clearAll: () =>
        set({
          user: null,
          tokens: [],
          drops: [],
          events: [],
          places: [],
          quests: [],
          mapMarkers: [],
          currentPosition: null,
          mapViewport: DEFAULT_VIEWPORT,
          visibilityMode: 'approximate',
          isMapReady: false,
          selectedMarkerId: null,
          activeBottomSheet: 'none',
          isLoading: false,
          notifications: [],
          claimed: {},
          tips: [],
          activity: [],
          broadcasts: [],
          stories: [],
          visibility: 'approximate',
          profilePrivacy: 'public',
          presenceStatus: 'online',
          presenceUntil: null,
          avatarMode: 'dicebear',
          avatarSeed: '',
          avatarImageData: null,
        }),
    }),
    {
      name: 'devcity26-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        visibilityMode: state.visibilityMode,
        mapViewport: state.mapViewport,
        visibility: state.visibility,
        profilePrivacy: state.profilePrivacy,
        avatarMode: state.avatarMode,
        avatarSeed: state.avatarSeed,
        avatarImageData: state.avatarImageData,
        claimed: state.claimed,
        tips: state.tips,
        broadcasts: state.broadcasts,
        activity: state.activity,
      }),
    }
  )
);

// Utility function for time formatting
export function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
