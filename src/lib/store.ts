import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Token, Drop, Event, Place, Quest, Position, VisibilityMode, MapMarker } from '@/types';

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

  activeBottomSheet: 'none' | 'profile' | 'drop' | 'event' | 'place' | 'quest' | 'token' | 'create-token' | 'create-drop' | 'wallet';
  setActiveBottomSheet: (sheet: AppState['activeBottomSheet']) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  notifications: Array<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }>;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;

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
        }),
    }),
    {
      name: 'devcity26-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        visibilityMode: state.visibilityMode,
        mapViewport: state.mapViewport,
      }),
    }
  )
);