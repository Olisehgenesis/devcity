export type EventPhase = 'upcoming' | 'live' | 'past' | 'undated';

export type EventWhen = {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

function clock(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

function instant(date: string | null | undefined, time: string | null | undefined, endOfDay: boolean): number | null {
  if (!date) return null;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T${clock(time, endOfDay ? '23:59:59' : '00:00:00')}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Classify an event from its stored dates. Missing or unreadable dates are undated, never live. */
export function eventPhase(event: EventWhen, now = Date.now()): EventPhase {
  const start = instant(event.startDate, event.startTime, false);
  if (start == null) return 'undated';
  const end = instant(event.endDate, event.endTime, true) ?? start + 24 * 60 * 60 * 1000;
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'past';
}

/** Going or interested is only valid before an event ends. Attended is only valid once it has started. */
export function rsvpAllowed(phase: EventPhase, status: string): boolean {
  if (status === 'attended') return phase === 'live' || phase === 'past';
  if (status === 'going' || status === 'interested') return phase === 'upcoming' || phase === 'live';
  return false;
}
