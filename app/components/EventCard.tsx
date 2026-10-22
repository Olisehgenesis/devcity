'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { eventPhase } from '@/lib/event-phase';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  userAddress,
  onNeedAccount,
}: {
  event: EventCardData;
  onClose: () => void;
  onShowOnMap: () => void;
  attendance: 'going' | 'attended' | null;
  onToggleGoing: () => void;
  userAddress?: string | null;
  onNeedAccount?: () => void;
}) {
  const phase = eventPhase(event);
  const startMs = useMemo(() => eventStartMs(event), [event]);
  const [, setTick] = useState(0);

  // 1s ticker while the card is open so the countdown/live window stays accurate.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [goingCount, setGoingCount] = useState(0);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [chat, setChat] = useState<Array<{ id: string; text: string; username: string | null }>>([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/events/${encodeURIComponent(event.id)}/rsvp`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/events/${encodeURIComponent(event.id)}/chat`).then((response) => response.ok ? response.json() : null),
    ]).then(([rsvp, messages]) => {
      if (cancelled) return;
      const people = (rsvp?.rsvps ?? []) as Array<{ username?: string | null; status?: string }>;
      const going = people.filter((person) => person.status === 'going' || !person.status);
      setGoingCount(Number(rsvp?.counts?.going ?? going.length) || 0);
      setAttendees(going.map((person) => person.username || 'Someone').slice(0, 8));
      setChat((messages?.messages ?? []) as Array<{ id: string; text: string; username: string | null }>);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [attendance, event.id]);

  async function sendChat(formEvent: FormEvent) {
    formEvent.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    if (!userAddress) {
      onNeedAccount?.();
      return;
    }
    setChatSending(true);
    setChatError('');
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, text }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; message?: { id: string; text: string; username: string | null } };
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      if (data.message) setChat((items) => [...items, data.message!]);
      setChatText('');
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally {
      setChatSending(false);
    }
  }

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
      <Button type="button" variant="outline" size="icon" className="event-card-close" onClick={onClose} aria-label="Close event card">
        <X size={18} />
      </Button>
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
        <Button
          type="button"
          variant={canRsvp ? 'default' : 'outline'}
          onClick={onToggleGoing}
          disabled={!canRsvp || attendance === 'attended'}
          aria-pressed={Boolean(attendance)}
        >
          {attendance === 'attended' ? 'Marked attended' : !canRsvp ? 'Date not set' : attendance === 'going' ? "You're going" : "I'm going"}
        </Button>
        {goingCount > 0 && <p className="event-card-facts">{goingCount === 1 ? '1 person is going' : `${goingCount} people are going`}{attendees.length > 0 ? ` · ${attendees.join(', ')}` : ''}</p>}
        <div className="event-card-links flex-col">
          {event.url && (
            <Button asChild variant="outline">
              <a href={event.url} target="_blank" rel="noopener noreferrer">Event page</a>
            </Button>
          )}
          {event.latitude !== null && event.longitude !== null && (
            <Button type="button" variant="outline" onClick={onShowOnMap}>Show on map</Button>
          )}
        </div>

        <details className="event-schedule">
          <summary className="event-schedule-title">Event chat <span>{chat.length}</span></summary>
          <div className="event-schedule-list">
            {chat.length === 0 && <p className="event-slot-meta">No messages yet. Say what you are looking forward to.</p>}
            {chat.map((message) => (
              <p className="broadcast-comment" key={message.id}><strong>{message.username || 'Someone'}</strong> {message.text}</p>
            ))}
            <form className="broadcast-comment-form" onSubmit={(formEvent) => void sendChat(formEvent)}>
              <input value={chatText} onChange={(input) => setChatText(input.target.value.slice(0, 500))} placeholder="Message the people going" aria-label="Event chat message" />
              <button type="submit" disabled={!chatText.trim() || chatSending} aria-label="Send event chat message">Send</button>
            </form>
            {chatError && <p className="you-error" role="alert">{chatError}</p>}
          </div>
        </details>

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
