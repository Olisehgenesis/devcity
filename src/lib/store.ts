import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  User,
  Token,
  Drop,
  Event,
  Place,
  Quest,
  Position,
  VisibilityMode,
  MapMarker,
  Claim,
  Tip,
  Broadcast,
  Story,
  ActivityItem,
  Presence,
  NearbyUser,
  AvatarMode,
  ProfilePrivacy,
  PresenceStatus,
  CreateDropInput,
  UpdateMeInput,
} from '@/types';
import { demoUser, demoDrops, demoMarkers, demoBroadcasts, demoStories, demoActivity } from '@/lib/demo-data';

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

  activeBottomSheet:
    | 'none'
    | 'profile'
    | 'drop'
    | 'event'
    | 'place'
    | 'quest'
    | 'token'
    | 'create-token'
    | 'create-drop'
    | 'wallet'
    | 'social'
    | 'avatar';
  setActiveBottomSheet: (sheet: AppState['activeBottomSheet']) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;

  // ─── Social state ────────────────────────────────────────────────────
  claims: Claim[];
  setClaims: (claims: Claim[]) => void;
  tips: Tip[];
  setTips: (tips: Tip[]) => void;
  broadcasts: Broadcast[];
  setBroadcasts: (broadcasts: Broadcast[]) => void;
  stories: Story[];
  setStories: (stories: Story[]) => void;
  activity: ActivityItem[];
  setActivity: (activity: ActivityItem[]) => void;
  presence: Presence | null;
  setPresence: (presence: Presence | null) => void;
  nearbyUsers: NearbyUser[];
  setNearbyUsers: (users: NearbyUser[]) => void;

  profilePrivacy: ProfilePrivacy;
  setProfilePrivacy: (privacy: ProfilePrivacy) => void;
  presenceStatus: PresenceStatus;
  setPresenceStatus: (status: PresenceStatus) => void;
  avatarMode: AvatarMode;
  setAvatarMode: (mode: AvatarMode) => void;
  avatarSeed: string;
  setAvatarSeed: (seed: string) => void;
  avatarImageData: string | null;
  setAvatarImageData: (data: string | null) => void;

  activeStory: Story | null;
  setActiveStory: (story: Story | null) => void;

  // ─── API sync actions ────────────────────────────────────────────────
  initSocial: () => Promise<void>;
  refreshAll: () => Promise<void>;
  loadDrops: () => Promise<void>;
  createDrop: (input: CreateDropInput) => Promise<Drop | null>;
  authorizeClaim: (
    dropId: string,
  ) => Promise<{ signature: string; dropId: string; amount: string; expiresAt: number } | null>;
  loadClaims: () => Promise<void>;
  updatePresence: (status: PresenceStatus) => Promise<void>;
  loadNearby: () => Promise<void>;
  loadBroadcasts: () => Promise<void>;
  createBroadcast: (text: string) => Promise<void>;
  likeBroadcast: (id: string) => Promise<void>;
  commentBroadcast: (id: string, text: string) => Promise<void>;
  loadStories: () => Promise<void>;
  createStory: (content: string) => Promise<void>;
  loadActivity: () => Promise<void>;
  loadMe: () => Promise<void>;
  updateMe: (updates: UpdateMeInput) => Promise<void>;

  clearAll: () => void;
}

const DEFAULT_VIEWPORT = {
  center: { lat: -1.2921, lng: 36.8219, timestamp: Date.now() },
  zoom: 15,
  bearing: 0,
  pitch: 0,
};

const DEMO_ADDRESS = '0x742d35Cc6634C0532925a3b8D4C0532925a3b8D4';

function toEpoch(value: any): number {
  if (value == null) return Date.now();
  const num = Number(value);
  if (!isNaN(num) && num > 0) return num;
  const parsed = Date.parse(String(value));
  return isNaN(parsed) ? Date.now() : parsed;
}

async function api<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function userAddressOf(state: AppState): string {
  return state.user?.walletAddress || DEMO_ADDRESS;
}

function mapApiDrop(raw: any): Drop | null {
  if (!raw) return null;
  const amount = raw.amountPerClaim ?? raw.amount ?? '0';
  const maxClaimants = Number(raw.maxClaimants ?? raw.maxClaims ?? 0);
  const currentClaimants = Number(raw.claimsCount ?? raw.currentClaimants ?? 0);
  const lat = Number(raw.latitude ?? raw.lat ?? -1.2921);
  const lng = Number(raw.longitude ?? raw.lng ?? 36.8219);
  const now = Date.now();
  const startTime = Number(raw.startsAt ?? raw.startTime ?? now);
  const endTime = Number(raw.endsAt ?? raw.endTime ?? now + 3600000);
  const status =
    raw.status?.toLowerCase?.() ??
    (now >= startTime && now <= endTime ? 'active' : 'upcoming');
  return {
    id: raw.id,
    tokenId: raw.tokenId ?? '',
    tokenSymbol: raw.tokenSymbol ?? raw.token?.symbol ?? 'TOKEN',
    tokenIconUrl: raw.tokenIconUrl ?? raw.token?.iconUrl ?? '',
    totalAmount: raw.totalAmount ?? amount,
    amountPerClaim: amount,
    maxClaimants,
    currentClaimants,
    location: { lat, lng, timestamp: now },
    radius: Number(raw.radius ?? 100),
    startTime,
    endTime,
    status,
    claimedBy: raw.claimedBy ?? [],
    createdAt: Number(raw.createdAt ?? now),
  };
}

function mapApiBroadcast(raw: any): Broadcast {
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map((c: any) => ({
        id: c.id,
        text: c.text,
        at: Number(c.createdAt ?? c.at ?? Date.now()),
        userAddress: c.userAddress ?? c.user?.walletAddress,
        username: c.username ?? c.user?.name ?? 'someone',
      }))
    : [];
  return {
    id: raw.id,
    text: raw.text,
    at: Number(raw.createdAt ?? raw.at ?? Date.now()),
    userAddress: raw.userAddress ?? raw.user?.walletAddress,
    username: raw.username ?? raw.user?.name ?? 'someone',
    avatarUrl: raw.avatarUrl ?? raw.user?.image,
    likes: Number(raw.likes ?? raw._count?.likes ?? 0),
    liked: Boolean(raw.liked ?? raw.likedByMe ?? false),
    comments,
  };
}

function mapApiStory(raw: any): Story {
  return {
    id: raw.id,
    userAddress: raw.userAddress ?? raw.user?.walletAddress,
    username: raw.username ?? raw.user?.name ?? 'someone',
    avatarUrl: raw.avatarUrl ?? raw.user?.image,
    content: raw.content ?? raw.text ?? '',
    createdAt: Number(raw.createdAt ?? raw.at ?? Date.now()),
    place: raw.place,
  };
}

function mapApiActivity(raw: any): ActivityItem {
  return {
    id: raw.id,
    kind: raw.kind ?? 'join',
    text: raw.text,
    at: Number(raw.createdAt ?? raw.at ?? Date.now()),
    userAddress: raw.userAddress ?? raw.user?.walletAddress,
    username: raw.username ?? raw.user?.name,
  };
}

function mapApiNearbyUser(raw: any): NearbyUser {
  return {
    id: raw.id ?? raw.userId,
    username: raw.username ?? raw.name ?? 'someone',
    walletAddress: raw.walletAddress ?? raw.user?.walletAddress,
    avatarUrl: raw.avatarUrl ?? raw.user?.image,
    status: (raw.status ?? 'online').toLowerCase(),
    distance: Number(raw.distance ?? 0),
    lat: raw.lat ? Number(raw.lat) : undefined,
    lng: raw.lng ? Number(raw.lng) : undefined,
    lastActive: Number(raw.lastActive ?? raw.updatedAt ?? Date.now()),
    tokenSymbol: raw.tokenSymbol,
  };
}

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
          notifications: [
            ...state.notifications,
            { ...notification, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // ─── Social state ────────────────────────────────────────────────
      claims: [],
      setClaims: (claims) => set({ claims }),
      tips: [],
      setTips: (tips) => set({ tips }),
      broadcasts: [],
      setBroadcasts: (broadcasts) => set({ broadcasts }),
      stories: [],
      setStories: (stories) => set({ stories }),
      activity: [],
      setActivity: (activity) => set({ activity }),
      presence: null,
      setPresence: (presence) => set({ presence }),
      nearbyUsers: [],
      setNearbyUsers: (users) => set({ nearbyUsers: users }),

      profilePrivacy: 'public',
      setProfilePrivacy: (privacy) => set({ profilePrivacy: privacy }),
      presenceStatus: 'online',
      setPresenceStatus: (status) => set({ presenceStatus: status }),
      avatarMode: 'dicebear',
      setAvatarMode: (mode) => set({ avatarMode: mode }),
      avatarSeed: '',
      setAvatarSeed: (seed) => set({ avatarSeed: seed }),
      avatarImageData: null,
      setAvatarImageData: (data) => set({ avatarImageData: data }),

      activeStory: null,
      setActiveStory: (story) => set({ activeStory: story }),

      // ─── API sync actions ────────────────────────────────────────────
      initSocial: async () => {
        if (!get().user) {
          set({ user: demoUser as User });
        }
        await get().refreshAll();
      },

      refreshAll: async () => {
        const state = get();
        await Promise.allSettled([
          get().loadMe(),
          get().loadDrops(),
          get().loadClaims(),
          get().loadBroadcasts(),
          get().loadStories(),
          get().loadActivity(),
          get().loadNearby(),
        ]);
        get().updatePresence(state.presenceStatus);
      },

      loadDrops: async () => {
        const data = await api<{ drops: any[] }>('/api/drops');
        if (data?.drops?.length) {
          const drops = data.drops.map(mapApiDrop).filter(Boolean) as Drop[];
          if (drops.length) set({ drops });
        } else if (get().drops.length === 0) {
          set({ drops: demoDrops as unknown as Drop[] });
        }
      },

      createDrop: async (input) => {
        const data = await api<{ drop: any }>('/api/drops', {
          method: 'POST',
          body: JSON.stringify({
            ...input,
            creatorAddress: userAddressOf(get()),
          }),
        });
        if (data?.drop) {
          const drop = mapApiDrop(data.drop);
          if (drop) {
            set((state) => ({ drops: [drop, ...state.drops] }));
            return drop;
          }
        }
        return null;
      },

      authorizeClaim: async (dropId) => {
        const data = await api<{ signature: string; dropId: string; amount: string; expiresAt: number }>(
          '/api/claims/authorize',
          {
            method: 'POST',
            body: JSON.stringify({ dropId, userAddress: userAddressOf(get()) }),
          },
        );
        if (data?.signature) {
          await get().loadClaims();
          return data;
        }
        return null;
      },

      loadClaims: async () => {
        const data = await api<{ claims: any[] }>(
          `/api/claims?userAddress=${encodeURIComponent(userAddressOf(get()))}`,
        );
        if (data?.claims) {
          set({
            claims: data.claims.map((c: any) => ({
              id: c.id,
              dropId: c.dropId,
              dropName: c.dropName ?? c.drop?.name,
              tokenSymbol: c.tokenSymbol ?? c.drop?.tokenSymbol ?? 'TOKEN',
              amount: c.amount ?? c.amountPerClaim ?? '0',
              status: (c.status ?? 'confirmed') as Claim['status'],
              txHash: c.txHash,
              claimedAt: Number(c.claimedAt ?? c.createdAt ?? c.at ?? Date.now()),
            })),
          });
        }
      },

      updatePresence: async (status) => {
        set({ presenceStatus: status });
        const pos = get().currentPosition;
        const data = await api<{ presence: any }>('/api/presence/update', {
          method: 'POST',
          body: JSON.stringify({
            status,
            lat: pos?.lat ?? -1.2921,
            lng: pos?.lng ?? 36.8219,
            visibility: get().visibilityMode,
          }),
        });
        if (data?.presence) {
          set({
            presence: {
              status: data.presence.status ?? status,
              lat: Number(data.presence.lat ?? pos?.lat ?? -1.2921),
              lng: Number(data.presence.lng ?? pos?.lng ?? 36.8219),
              visibility: data.presence.visibility ?? get().visibilityMode,
              updatedAt: Number(data.presence.updatedAt ?? data.presence.lastActive ?? Date.now()),
            },
          });
        }
      },

      loadNearby: async () => {
        const pos = get().currentPosition;
        const data = await api<{ users: any[] }>(
          `/api/presence/nearby?lat=${pos?.lat ?? -1.2921}&lng=${pos?.lng ?? 36.8219}&radius=5000`,
        );
        if (data?.users) {
          set({ nearbyUsers: data.users.map(mapApiNearbyUser) });
        }
      },

      loadBroadcasts: async () => {
        const data = await api<{ broadcasts: any[] }>('/api/broadcasts');
        if (data?.broadcasts) {
          set({ broadcasts: data.broadcasts.map(mapApiBroadcast) });
        } else if (get().broadcasts.length === 0) {
          set({ broadcasts: demoBroadcasts as unknown as Broadcast[] });
        }
      },

      createBroadcast: async (text) => {
        const data = await api<{ broadcast: any }>('/api/broadcasts', {
          method: 'POST',
          body: JSON.stringify({ text, userAddress: userAddressOf(get()) }),
        });
        if (data?.broadcast) {
          set((state) => ({
            broadcasts: [mapApiBroadcast(data.broadcast), ...state.broadcasts],
          }));
        }
      },

      likeBroadcast: async (id) => {
        const data = await api<{ broadcast: any }>(`/api/broadcasts/${id}/like`, {
          method: 'POST',
        });
        if (data?.broadcast) {
          set((state) => ({
            broadcasts: state.broadcasts.map((b) =>
              b.id === id ? mapApiBroadcast(data.broadcast) : b,
            ),
          }));
        }
      },

      commentBroadcast: async (id, text) => {
        const data = await api<{ broadcast: any }>(`/api/broadcasts/${id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text, userAddress: userAddressOf(get()) }),
        });
        if (data?.broadcast) {
          set((state) => ({
            broadcasts: state.broadcasts.map((b) =>
              b.id === id ? mapApiBroadcast(data.broadcast) : b,
            ),
          }));
        }
      },

      loadStories: async () => {
        const data = await api<{ stories: any[] }>('/api/stories');
        if (data?.stories) {
          set({ stories: data.stories.map(mapApiStory) });
        } else if (get().stories.length === 0) {
          set({ stories: demoStories as unknown as Story[] });
        }
      },

      createStory: async (content) => {
        const data = await api<{ story: any }>('/api/stories', {
          method: 'POST',
          body: JSON.stringify({ content, userAddress: userAddressOf(get()) }),
        });
        if (data?.story) {
          set((state) => ({
            stories: [mapApiStory(data.story), ...state.stories],
          }));
        }
      },

      loadActivity: async () => {
        const data = await api<{ activity: any[] }>(
          `/api/activity?userAddress=${encodeURIComponent(userAddressOf(get()))}`,
        );
        if (data?.activity) {
          set({ activity: data.activity.map(mapApiActivity) });
        } else if (get().activity.length === 0) {
          set({ activity: demoActivity as unknown as ActivityItem[] });
        }
      },

      loadMe: async () => {
        const data = await api<{ user: any; avatar: any; visibility: any; presence: any }>(
          `/api/me?userAddress=${encodeURIComponent(userAddressOf(get()))}`,
        );
        if (data?.user) {
          const u = data.user;
          set({
            user: {
              id: u.id ?? u.walletAddress,
              walletAddress: u.walletAddress ?? u.id,
              username: u.username ?? u.name ?? 'genesis',
              avatarUrl: u.avatarUrl ?? u.image ?? '',
              visibility: (u.visibility ?? data.visibility ?? get().visibilityMode) as VisibilityMode,
              createdAt: Number(u.createdAt ?? u.joinedAt ?? Date.now()),
              updatedAt: Number(u.updatedAt ?? Date.now()),
            },
            avatarMode: (data.avatar?.mode as AvatarMode) ?? get().avatarMode,
            avatarSeed: data.avatar?.seed ?? get().avatarSeed,
            avatarImageData: data.avatar?.imageData ?? get().avatarImageData,
            visibilityMode: (data.visibility ?? get().visibilityMode) as VisibilityMode,
            presenceStatus: (data.presence?.status ?? get().presenceStatus) as PresenceStatus,
            presence: data.presence
              ? {
                  status: data.presence.status,
                  lat: Number(data.presence.lat ?? -1.2921),
                  lng: Number(data.presence.lng ?? 36.8219),
                  visibility: data.presence.visibility ?? get().visibilityMode,
                  updatedAt: Number(data.presence.updatedAt ?? data.presence.lastActive ?? Date.now()),
                }
              : get().presence,
          });
        }
      },

      updateMe: async (updates) => {
        const data = await api<{ user: any }>('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({
            ...updates,
            userAddress: updates.userAddress ?? userAddressOf(get()),
          }),
        });
        if (data?.user) {
          const u = data.user;
          set({
            user: {
              id: u.id ?? u.walletAddress,
              walletAddress: u.walletAddress ?? u.id,
              username: u.username ?? u.name ?? 'genesis',
              avatarUrl: u.avatarUrl ?? u.image ?? '',
              visibility: (u.visibility ?? get().visibilityMode) as VisibilityMode,
              createdAt: Number(u.createdAt ?? u.joinedAt ?? Date.now()),
              updatedAt: Number(u.updatedAt ?? Date.now()),
            },
          });
        }
        if (updates.avatarMode !== undefined) set({ avatarMode: updates.avatarMode });
        if (updates.avatarSeed !== undefined) set({ avatarSeed: updates.avatarSeed });
        if (updates.avatarImageData !== undefined) set({ avatarImageData: updates.avatarImageData });
        if (updates.visibility !== undefined) set({ visibilityMode: updates.visibility });
        if (updates.presenceStatus !== undefined) set({ presenceStatus: updates.presenceStatus });
      },

      clearAll: () =>
        set({
          user: null,
          tokens: [],
          drops: [],
          events: [],
          places: [],
          quests: [],
          mapMarkers: [],
          claims: [],
          tips: [],
          broadcasts: [],
          stories: [],
          activity: [],
          presence: null,
          nearbyUsers: [],
          activeStory: null,
          activeBottomSheet: 'none',
        }),
    }),
    {
      name: 'devcity26-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        visibilityMode: state.visibilityMode,
        mapViewport: state.mapViewport,
        profilePrivacy: state.profilePrivacy,
        presenceStatus: state.presenceStatus,
        avatarMode: state.avatarMode,
        avatarSeed: state.avatarSeed,
        avatarImageData: state.avatarImageData,
      }),
    },
  ),
);
