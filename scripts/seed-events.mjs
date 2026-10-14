#!/usr/bin/env node
/**
 * Seeds Devcon 8 week events + day-by-day timetables from krew3.site/events.
 *
 * Usage:
 *   npm run db:seed              # fetch live from https://www.krew3.site/events
 *   node scripts/seed-events.mjs --offline
 *                                # seed from scripts/data/krew3-events.json snapshot
 *
 * The krew3 events page embeds its event list in the TanStack Start
 * dehydrated-router payload ($_TSR.router). This script extracts that payload,
 * maps every event to an `Event` row, and expands each event's date range into
 * one `TimetableSlot` per day so the UI can render each event as a card that
 * expands (down arrow) into its day-by-day timetable.
 */
import { readFileSync } from 'node:fs';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const EVENTS_URL = 'https://www.krew3.site/events';
const SNAPSHOT_PATH = new URL('./data/krew3-events.json', import.meta.url);
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

async function fetchEventsLive() {
  const res = await fetch(EVENTS_URL, {
    headers: { 'user-agent': 'devcity26-seed/1.0 (+https://github.com/Olisehgenesis/devcity)' },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const events = parseKrew3Html(html);
  if (!events.length) throw new Error('No events found in page payload');
  return events;
}

/**
 * Extract the serialized TanStack router payload ($_TSR.router=...) from the
 * server-rendered page and pull the events array out of it.
 */
export function parseKrew3Html(html) {
  const match = html.match(/<script[^>]*>\s*(\$_TSR\.router=[\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not find serialized router data in the page');
  const router = new Function(`let $R = { tsr: [] }; let $_TSR = {}; ${match[1]}; return $_TSR.router;`)();
  const events = findEvents(router);
  if (!events) throw new Error('Events array not found in router data');
  return events;
}

function findEvents(node) {
  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === 'object' && 'slug' in node[0] && 'organizer' in node[0]) {
      return node;
    }
    for (const child of node) {
      const found = findEvents(child);
      if (found) return found;
    }
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findEvents(value);
      if (found) return found;
    }
  }
  return null;
}

async function loadEvents() {
  if (process.argv.includes('--offline')) {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    console.log(`Loaded ${snapshot.events.length} events from snapshot (${snapshot.fetchedAt})`);
    return snapshot.events;
  }
  try {
    const events = await fetchEventsLive();
    console.log(`Fetched ${events.length} events from ${EVENTS_URL}`);
    return events;
  } catch (err) {
    console.warn(`Live fetch failed (${err.message}); falling back to bundled snapshot.`);
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    console.log(`Loaded ${snapshot.events.length} events from snapshot (${snapshot.fetchedAt})`);
    return snapshot.events;
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function normalizeTime(value) {
  if (!value) return null;
  const m = /^(\d{2}:\d{2})/.exec(value);
  return m ? m[1] : null;
}

function eachDay(startDate, endDate) {
  const days = [];
  const end = new Date(endDate);
  for (let d = new Date(startDate); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
    if (days.length > 120) break; // safety cap for open-ended ranges
  }
  return days;
}

function buildTimetable(event) {
  const start = event.startDate;
  const end = event.endDate ?? event.startDate;
  if (!start) return [];
  const days = eachDay(start, end);
  const multiDay = days.length > 1;
  return days.map((date, i) => ({
    date,
    dayNumber: i + 1,
    label: multiDay ? `Day ${i + 1}` : null,
    startTime: multiDay ? null : event.startTime,
    endTime: multiDay ? null : event.endTime,
    allDay: multiDay || !event.startTime,
    title: multiDay ? `${event.name} — Day ${i + 1}` : event.name,
  }));
}

// ---------------------------------------------------------------------------
// Geocoding — known venues + deterministic jitter for city-level locations
// ---------------------------------------------------------------------------

const VENUE_COORDS = [
  { match: /jio world convention centre/i, lat: 19.0669, lng: 72.8685 },
  { match: /cidco exhibition/i, lat: 19.0726, lng: 72.9976 },
  { match: /royal opera house/i, lat: 18.975, lng: 72.8193 },
  { match: /fairmont mumbai/i, lat: 19.066, lng: 72.867 },
  { match: /taj lands end/i, lat: 19.0436, lng: 72.8256 },
  { match: /ifbe|ballard estate/i, lat: 18.933, lng: 72.842 },
  { match: /mandrem/i, lat: 15.68, lng: 73.71 },
];

const REGION_FALLBACK = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  goa: { lat: 15.2993, lng: 74.124 },
};

// Deterministic hash so re-seeds keep the same jittered coordinates.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function geocode(raw) {
  const location = raw.location || '';
  const venue = VENUE_COORDS.find((v) => v.match.test(location));
  if (venue) return { lat: venue.lat, lng: venue.lng };

  const base = REGION_FALLBACK[raw.region] || REGION_FALLBACK.mumbai;
  // Spread city-level events deterministically within ~0.06° (~6km) of the center.
  const h = hashSeed(raw.slug);
  const lat = base.lat + (((h % 1000) / 1000) * 0.12 - 0.06);
  const lng = base.lng + (((h % 997) / 997) * 0.12 - 0.06);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function toEventRow(raw) {
  const startDate = raw.date ? new Date(`${raw.date}T00:00:00.000Z`) : null;
  const endDate = raw.endDate ? new Date(`${raw.endDate}T00:00:00.000Z`) : null;
  const coords = geocode(raw);
  return {
    slug: raw.slug,
    name: raw.name,
    organizer: raw.organizer || 'Unknown',
    summary: raw.summary || null,
    category: raw.category || null,
    kind: raw.kind || null,
    region: raw.region || null,
        location: raw.location || null,
        imageUrl: raw.imageUrl || raw.image || raw.coverImage || null,
        latitude: coords.lat,
    longitude: coords.lng,
    online: Boolean(raw.online),
    startDate,
    endDate,
    startTime: normalizeTime(raw.startTime),
    endTime: normalizeTime(raw.endTime),
    url: raw.url || null,
    source: 'krew3',
    externalId: raw.id ?? null,
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed(rawEvents) {
  let eventsUpserted = 0;
  let slotsCreated = 0;

  for (const raw of rawEvents) {
    const row = toEventRow(raw);
    const event = await prisma.event.upsert({
      where: { slug: row.slug },
      create: row,
      update: {
        name: row.name,
        organizer: row.organizer,
        summary: row.summary,
        category: row.category,
        kind: row.kind,
        region: row.region,
        location: row.location,
        imageUrl: row.imageUrl,
        latitude: row.latitude,
        longitude: row.longitude,
        online: row.online,
        startDate: row.startDate,
        endDate: row.endDate,
        startTime: row.startTime,
        endTime: row.endTime,
        url: row.url,
        externalId: row.externalId,
        isActive: true,
      },
    });

    // Rebuild the timetable for this event (idempotent re-seed).
    const slots = buildTimetable(row).map((slot) => ({
      eventId: event.id,
      ...slot,
    }));
    await prisma.timetableSlot.deleteMany({ where: { eventId: event.id } });
    if (slots.length) {
      const result = await prisma.timetableSlot.createMany({ data: slots });
      slotsCreated += result.count;
    }
    eventsUpserted += 1;
  }

  return { eventsUpserted, slotsCreated };
}

async function main() {
  const rawEvents = await loadEvents();
  console.log(`Seeding ${rawEvents.length} events from krew3.site ...`);
  const { eventsUpserted, slotsCreated } = await seed(rawEvents);
  console.log(`✔ Upserted ${eventsUpserted} events`);
  console.log(`✔ Seeded ${slotsCreated} timetable slots`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
