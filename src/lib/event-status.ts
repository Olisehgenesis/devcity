export type EventPhase = "live" | "upcoming" | "past" | "undated";

export type EventScheduleInput = {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

export type EventWindow = {
  phase: EventPhase;
  start: number | null;
  end: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stored event clocks have no offset. The app treats them as UTC and labels them that way. */
export function parseEventInstant(date?: string | null, time?: string | null, fallbackTime?: string): number | null {
  if (!date?.trim()) return null;
  const clock = (time?.trim() || fallbackTime || "00:00:00").replace(/Z$/i, "");
  const parsed = new Date(`${date.trim()}T${clock}Z`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function eventWindow(event: EventScheduleInput, now = Date.now()): EventWindow {
  const start = parseEventInstant(event.startDate, event.startTime, "00:00:00");
  if (start == null) return { phase: "undated", start: null, end: null };
  const explicitEnd = parseEventInstant(event.endDate, event.endTime, "23:59:59");
  const end = explicitEnd ?? start + DAY_MS;
  if (now < start) return { phase: "upcoming", start, end };
  if (now > end) return { phase: "past", start, end };
  return { phase: "live", start, end };
}

export function formatEventCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

export function formatEventWhen(event: EventScheduleInput): string {
  const start = parseEventInstant(event.startDate, event.startTime, "00:00:00");
  if (start == null) return "Schedule not set";
  const when = new Date(start);
  const date = when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const clock = event.startTime?.trim()
    ? when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23" })
    : null;
  return clock ? `${date} · ${clock} UTC` : `${date} · UTC`;
}

export function eventPhaseLabel(window: EventWindow, now = Date.now()): string {
  if (window.phase === "undated" || window.start == null) return "Schedule not set";
  if (window.phase === "live") return "Live now";
  if (window.phase === "past") return "Ended";
  return `Starts in ${formatEventCountdown(window.start - now)}`;
}
