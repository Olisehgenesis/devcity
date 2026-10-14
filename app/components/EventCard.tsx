'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, ExternalLink, LocateFixed, MapPin, Navigation, Ticket, Video } from 'lucide-react';

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

function parseTs(event: EventCardData): { start: number; end: number } {
  const start = event.startDate
    ? new Date(`${event.startDate}T${event.startTime || '00:00:00'}Z`).getTime()
    : Date.now();
  const end = event.endDate
    ? new Date(`${event.endDate}T${event.endTime || '23:59:59'}Z`).getTime()
    : start + 24 * 3600 * 1000;
  return { start: Number.isNaN(start) ? Date.now() : start, end: Number.isNaN(end) ? start + 24 * 3600 * 1000 : end };
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
}: {
  event: EventCardData;
  onClose: () => void;
  onShowOnMap: () => void;
}) {
  const { start, end } = useMemo(() => parseTs(event), [event]);
  const [, setTick] = useState(0);

  // 1s ticker while the card is open so the countdown/live window stays accurate.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const isLive = now >= start && now <= end;
  const isUpcoming = now < start;
  const isDevcon = /devcon/i.test(event.name || '') || /devcon/i.test(event.organizer || '');

  const startLabel = useMemo(() => {
    if (!event.startDate) return '';
    const d = new Date(`${event.startDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return event.startDate;
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }, [event.startDate]);

  const endLabel = useMemo(() => {
    if (!event.endDate) return null;
    const d = new Date(`${event.endDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return event.endDate;
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }, [event.endDate]);

  const timeRange = [event.startTime, event.endTime].filter(Boolean).join(' – ') || null;
  const directionsUrl = event.latitude !== null && event.longitude !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
    : event.location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
      : null;

  return (
    <article className={`event-card${isDevcon ? ' is-devcon' : ''}`}>
      {/* Status line on top */}
      <div className={`event-status${isLive ? ' is-live' : ''}`}>
        {isLive ? (
          <>
            <span className="live-dot" /> LIVE NOW
          </>
        ) : isUpcoming ? (
          <>
            <Clock size={13} /> Starts in {formatCountdown(start - now)}
          </>
        ) : (
          <>Ended</>
        )}
        {isDevcon && <span className="event-gold-badge">★ Devcon</span>}
      </div>

      {/* Banner: image or gradient fallback (gold for Devcon) */}
      {event.imageUrl ? (
        <div className="event-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.imageUrl} alt={event.name} />
          <div className="event-banner-shade" />
        </div>
      ) : (
        <div className={`event-banner event-banner-fallback${isDevcon ? ' devcon-gold' : ''}`}>
          <span className="event-banner-initials">
            {event.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0] || '')
              .join('')
              .toUpperCase() || 'EV'}
          </span>
        </div>
      )}

      <div className="event-card-body">
        <div className="event-card-head">
          <div className="event-card-title-wrap">
            <h2 className="event-card-title">{event.name}</h2>
            {event.organizer && <p className="event-card-organizer">Hosted by {event.organizer}</p>}
          </div>
        </div>

        {/* Meta chips */}
        <div className="event-card-chips">
          {event.category && <span className="chip">{event.category}</span>}
          {event.kind && <span className="chip">{event.kind}</span>}
          {event.region && <span className="chip">{event.region}</span>}
          <span className="chip">
            {event.online ? (
              <>
                <Video size={12} /> Online
              </>
            ) : (
              <>
                <MapPin size={12} /> In person
              </>
            )}
          </span>
        </div>

        {/* Date / time / venue */}
        <div className="event-card-rows">
          {(startLabel || endLabel) && (
            <div className="event-row">
              <CalendarDays size={15} />
              <span>
                {startLabel}
                {endLabel && endLabel !== startLabel ? ` – ${endLabel}` : ''}
                {timeRange ? ` · ${timeRange}` : ''}
              </span>
            </div>
          )}
          {event.location && (
            <div className="event-row">
              <MapPin size={15} />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Full summary */}
        {event.summary && <p className="event-card-summary">{event.summary}</p>}

        {/* Tickets / RSVP */}
        {(event.url || (!event.online && directionsUrl)) && (
          <div className="event-card-actions">
            {event.url && (
              <a
                className={`event-card-cta${isDevcon ? ' devcon-gold-button' : ''}`}
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Ticket size={15} />
                {isDevcon ? 'Open Devcon event' : 'Open event'}
                <ExternalLink size={14} className="op-70" />
              </a>
            )}
            {directionsUrl && !event.online && (
              <a className="event-card-directions" href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation size={15} /> Get directions <ExternalLink size={13} />
              </a>
            )}
            {!event.online && event.latitude !== null && event.longitude !== null && (
              <button className="event-card-map-action" onClick={onShowOnMap}>
                <LocateFixed size={15} /> Show on map
              </button>
            )}
          </div>
        )}

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

        <button className="event-card-close" onClick={onClose} aria-label="Close event">
          Close
        </button>
      </div>
    </article>
  );
}
