import { create } from 'zustand';

/**
 * DEVCITY26 · game layer
 * Cosmetic, non-financial progress (level, streak, badges, sticker album).
 * Progression is derived from REAL on-chain/DB activity (claims, tips, events,
 * hosted spots, broadcasts) — never from fake points. The database is the
 * source of truth; this zustand store is only an in-memory cache hydrated from
 * /api/game and synced through /api/game/actions.
 */

export type BadgeId =
  | 'first-claim'
  | 'explorer'
  | 'generous-tipper'
  | 'early-bird'
  | 'streak-flame'
  | 'level-up'
  | 'event-host'
  | 'night-owl'
  | 'event-pass';

export interface BadgeDef {
  id: BadgeId;
  label: string;
  blurb: string;
  tone: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-claim', label: 'First Claim', blurb: 'Claimed a token drop', tone: 'lime' },
  { id: 'explorer', label: 'Explorer', blurb: 'Opened the city map at night', tone: 'sky' },
  { id: 'generous-tipper', label: 'Generous Tipper', blurb: 'Sent a real tip', tone: 'coral' },
  { id: 'early-bird', label: 'Early Bird', blurb: 'Started a 3-day streak', tone: 'butter' },
  { id: 'streak-flame', label: 'Streak Flame', blurb: 'Kept a 7-day streak', tone: 'sun' },
  { id: 'level-up', label: 'Level Up', blurb: 'Hit level 3 from real activity', tone: 'blush' },
  { id: 'event-host', label: 'Event Host', blurb: 'Created a city spot', tone: 'mint' },
  { id: 'night-owl', label: 'Night Owl', blurb: 'Active after 10pm local', tone: 'ink' },
  { id: 'event-pass', label: 'Event Pass', blurb: 'RSVP’d to an event', tone: 'sky' },
];

export interface StickerDef {
  id: string;
  label: string;
  tone: string;
}

export const STICKER_DEFS: StickerDef[] = [
  { id: 'city', label: 'City Sticker', tone: 'sky' },
  { id: 'coast', label: 'Coast Sticker', tone: 'blue' },
  { id: 'gate', label: 'Gateway Sticker', tone: 'sun' },
  { id: 'tower', label: 'Hub Tower', tone: 'lime' },
  { id: 'stage', label: 'Stage Sticker', tone: 'coral' },
  { id: 'cafe', label: 'Café Sticker', tone: 'butter' },
  { id: 'booth', label: 'Booth Sticker', tone: 'mint' },
  { id: 'gazebo', label: 'Gazebo Sticker', tone: 'blush' },
  { id: 'kiosk', label: 'Info Kiosk', tone: 'sky' },
];

export interface ActivityCounts {
  claims: number;
  tipsSent: number;
  events: number;
  spots: number;
  broadcasts: number;
  total: number;
}

export interface GameProfile {
  level: number;
  counts: ActivityCounts;
  streak: number;
  lastVisitDay: string | null;
  badges: BadgeId[];
  stickers: Record<string, number>;
  leaderboardsOptIn: boolean;
}

export function levelProgress(level: number): { level: number; into: number; needed: number } {
  // Real-activity tiers: each level covers ACTIONS_PER_LEVEL real actions.
  const needed = 5;
  const into = 0; // not tracked client-side; server computes level from real counts
  return { level, into, needed };
}

interface GameStore extends GameProfile {
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadedFor: string | null;
  load: (userAddress: string) => Promise<void>;
  touchToday: (userAddress: string) => Promise<void>;
  awardBadge: (userAddress: string, id: BadgeId) => Promise<void>;
  collectSticker: (userAddress: string, id: string) => Promise<void>;
  setLeaderboardsOptIn: (userAddress: string, v: boolean) => Promise<void>;
  reset: () => void;
}

const initialCounts: ActivityCounts = { claims: 0, tipsSent: 0, events: 0, spots: 0, broadcasts: 0, total: 0 };

const initial: GameProfile = {
  level: 1,
  counts: initialCounts,
  streak: 0,
  lastVisitDay: null,
  badges: [],
  stickers: {},
  leaderboardsOptIn: false,
};

async function postAction(userAddress: string, payload: Record<string, unknown>): Promise<GameProfile> {
  const res = await fetch('/api/game/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || !data.game) throw new Error(data.error || 'Could not update your progress.');
  return data.game;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initial,
  status: 'idle',
  loadedFor: null,

  load: async (userAddress) => {
    if (!userAddress) return;
    set({ status: 'loading' });
    try {
      const res = await fetch(`/api/game?userAddress=${encodeURIComponent(userAddress)}`);
      const data = await res.json();
      if (!res.ok || !data.game) throw new Error(data.error || 'Could not load your progress.');
      set({ ...data.game, status: 'ready', loadedFor: userAddress });
    } catch {
      set({ status: 'error', ...initial });
    }
  },

  touchToday: async (userAddress) => {
    const game = await postAction(userAddress, { touch: true });
    set({ ...game, status: 'ready', loadedFor: userAddress });
  },

  awardBadge: async (userAddress, id) => {
    const game = await postAction(userAddress, { awardBadge: id });
    set({ ...game, status: 'ready', loadedFor: userAddress });
  },

  collectSticker: async (userAddress, id) => {
    const game = await postAction(userAddress, { collectSticker: id });
    set({ ...game, status: 'ready', loadedFor: userAddress });
  },

  setLeaderboardsOptIn: async (userAddress, v) => {
    const game = await postAction(userAddress, { leaderboardsOptIn: v });
    set({ ...game, status: 'ready', loadedFor: userAddress });
  },

  reset: () => set({ ...initial, status: 'idle', loadedFor: null }),
}));

export const gameToken = (count: number): string =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
