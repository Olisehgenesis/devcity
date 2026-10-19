'use client';

import { useEffect, useMemo, useState } from 'react';
import { eventPhase } from '@/lib/event-phase';
import { X } from 'lucide-react';

export interface EventCardData {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  summary: string | null;
  category: string | null;
  kind: string | null;
  region: string | null;
  location: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  url: string | null;
  timetable?: Array<{
    id: string;
    date: string;
    dayNumber: number | null;
    label: string | null;
    startTime: string | null;
    endTime: string | null;
    allDay: boolean;
    title: string | null;
  }>;
}

function dayStamp(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function eventStartMs(event: EventCardData): number | null {
  const day = dayStamp(event.startDate);
  if (!day) return null;
  const ms = Date.parse(`${day}T${event.startTime || '00:00:00'}Z`);
  return Number.isNaN(ms) ? null : ms;
}

function formatDay(value: string | null): string {
  const day = dayStamp(value);
  if (!day) return '';
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return d > 1 ? `${d}d ${h}h` : `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function EventCard({
  event,
  onClose,
  onShowOnMap,
  attendance,
  onToggleGoing,
}: {
  event: EventCardData;
  onClose: () => void;
  onShowOnMap: () => void;
  attendance: 'going' | 'attended' | null;
  onToggleGoing: () => void;
}) {
  const phase = eventPhase(event);
  const startMs = useMemo(() => eventStartMs(event), [event]);
  const [, setTick] = useState(0);

  // 1s ticker while the card is open so the countdown/live window stays accurate.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const isLive = phase === 'live';
  const isUpcoming = phase === 'upcoming';
  const canRsvp = isLive || isUpcoming;

  const startLabel = useMemo(() => formatDay(event.startDate), [event.startDate]);
  const endLabel = useMemo(() => formatDay(event.endDate) || null, [event.endDate]);

  const timeRange = [event.startTime, event.endTime].filter(Boolean).join('-') || null;
  const when = [
    startLabel,
    endLabel && endLabel !== startLabel ? `to ${endLabel}` : '',
    timeRange,
  ].filter(Boolean).join(' ');

  return (
    <article className="event-card">
      <button className="event-card-close" onClick={onClose} aria-label="Close event card">
        <X size={18} />
      </button>
      <div className="event-card-body">
        <span className="profile-gate-kicker">{event.category || 'Event'}</span>
        <p className={`event-status${isLive ? ' is-live' : ''}`}>
          {isLive ? 'Live now' : isUpcoming && startMs ? `Starts in ${formatCountdown(startMs - now)}` : phase === 'past' ? 'Ended' : 'Date not set'}
        </p>
        <h2 className="event-card-title">{event.name}</h2>
        {event.organizer && <p className="event-card-organizer">{event.organizer}</p>}
        {(when || event.location) && (
          <p className="event-card-facts">
            {when}
            {when && event.location ? '. ' : ''}
            {event.location}
          </p>
        )}
        {event.summary && <p className="event-card-summary">{event.summary}</p>}
        <button
          className={`you-connect-primary event-attendance-button${attendance ? ' is-going' : ''}`}
          onClick={onToggleGoing}
          disabled={!canRsvp || attendance === 'attended'}
          aria-pressed={Boolean(attendance)}
        >
          {attendance === 'attended' ? 'Marked attended' : !canRsvp ? 'Not open' : attendance === 'going' ? "You're going" : "I'm going"}
        </button>
        <div className="event-card-links">
          {event.url && (
            <a className="event-page-link" href={event.url} target="_blank" rel="noopener noreferrer">Event page</a>
          )}
          {event.latitude !== null && event.longitude !== null && (
            <button type="button" className="event-page-link" onClick={onShowOnMap}>Show on map</button>
          )}
        </div>

        {/* Schedule */}
        {event.timetable && event.timetable.length > 0 && (
          <details className="event-schedule">
            <summary className="event-schedule-title">View schedule <span>{event.timetable.length} sessions</span></summary>
            <div className="event-schedule-list">
              {event.timetable.map((slot) => {
                const d = new Date(`${slot.date}T00:00:00Z`);
                const day = Number.isNaN(d.getTime())
                  ? slot.date
                  : d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
                return (
                  <div className="event-slot" key={slot.id}>
                    <span className="event-slot-day">{day}</span>
                    <span className="event-slot-main">
                      <span className="event-slot-title">{slot.title || event.name}</span>
                      <span className="event-slot-meta">
                        {slot.label || ''}
                        {slot.startTime ? ` · ${slot.startTime}` : ''}
                        {slot.endTime ? `–${slot.endTime}` : ''}
                        {slot.allDay && !slot.startTime ? ' · All day' : ''}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        )}

      </div>
    </article>
  );
}
