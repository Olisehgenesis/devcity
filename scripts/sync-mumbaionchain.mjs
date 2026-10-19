#!/usr/bin/env node
/**
 * Pull the public event list from https://www.mumbaionchain.site/events.
 *
 *   node scripts/sync-mumbaionchain.mjs
 *     fetches the page, writes scripts/data/mumbaionchain-events.json
 *   node scripts/sync-mumbaionchain.mjs --offline
 *     reads that JSON and does not fetch
 *   dotenvx run -- node scripts/sync-mumbaionchain.mjs --seed
 *     writes the JSON, then upserts Event rows in the local database
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PAGE_URL = 'https://www.mumbaionchain.site/events';
const SNAPSHOT_PATH = new URL('./data/mumbaionchain-events.json', import.meta.url);
const EVENT_RE = /\{id:`([^`]*)`,title:`([^`]*)`,slug:`([^`]*)`,description:`([^`]*)`,organizer:`([^`]*)`,category:`([^`]*)`,startDate:`([^`]*)`,startTime:`([^`]*)`,endDate:`([^`]*)`,endTime:`([^`]*)`,timezone:`([^`]*)`,location:`([^`]*)`,address:`([^`]*)`,latitude:(-?\d+(?:\.\d+)?),longitude:(-?\d+(?:\.\d+)?),officialUrl:`([^`]*)`,mapUrl:`([^`]*)`,status:`([^`]*)`,priority:`([^`]*)`,imageUrl:`([^`]*)`,tags:\[([^\]]*)\]\}/g;

function tagsFrom(raw) {
  return [...raw.matchAll(/`([^`]*)`/g)].map((match) => match[1]).filter(Boolean);
}

export function parseMumbaiOnchainBundle(source) {
  const events = [];
  for (const match of source.matchAll(EVENT_RE)) {
    const [
      ,
      id,
      title,
      slug,
      description,
      organizer,
      category,
      startDate,
      startTime,
      endDate,
      endTime,
      timezone,
      location,
      address,
      latitude,
      longitude,
      officialUrl,
      mapUrl,
      status,
      priority,
      imageUrl,
      tags,
    ] = match;
    if (!slug || !title || !startDate) continue;
    events.push({
      id,
      slug,
      name: title,
      summary: description || null,
      organizer: organizer || null,
      category: category || null,
      date: startDate,
      startTime: startTime || null,
      endDate: endDate || startDate,
      endTime: endTime || null,
      timezone: timezone || null,
      location: address || location || null,
      venue: location || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      url: officialUrl || null,
      mapUrl: mapUrl || null,
      status: status || null,
      priority: priority || null,
      imageUrl: imageUrl || null,
      tags: tagsFrom(tags),
    });
  }
  const bySlug = new Map();
  for (const event of events) bySlug.set(event.slug, event);
  return [...bySlug.values()];
}

async function fetchBundle() {
  const page = await fetch(PAGE_URL, {
    headers: { 'user-agent': 'devcity26-sync/1.0' },
  });
  if (!page.ok) throw new Error(`Events page returned ${page.status}`);
  const html = await page.text();
  const script = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!script) throw new Error('The events page has no app script to read');
  const bundleUrl = new URL(script[1], PAGE_URL);
  const bundle = await fetch(bundleUrl, {
    headers: { 'user-agent': 'devcity26-sync/1.0' },
  });
  if (!bundle.ok) throw new Error(`App script returned ${bundle.status}`);
  return bundle.text();
}

function readSnapshot() {
  return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
}

function writeSnapshot(events) {
  const snapshot = {
    source: PAGE_URL,
    fetchedAt: new Date().toISOString(),
    count: events.length,
    events,
  };
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function eachDay(startDate, endDate) {
  const days = [];
  const end = new Date(`${endDate}T00:00:00.000Z`);
  for (let day = new Date(`${startDate}T00:00:00.000Z`); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(new Date(day));
    if (days.length > 40) break;
  }
  return days;
}

async function seed(events) {
  const pkg = await import('@prisma/client');
  const prisma = new pkg.PrismaClient();
  let eventsUpserted = 0;
  let slotsCreated = 0;
  try {
    for (const raw of events) {
      const row = {
        slug: raw.slug,
        name: raw.name,
        organizer: raw.organizer || 'Mumbai Onchain',
        summary: raw.summary,
        category: raw.category,
        kind: raw.category ? raw.category.toLowerCase() : null,
        region: 'mumbai',
        location: raw.location,
        imageUrl: raw.imageUrl && raw.imageUrl.startsWith('http') ? raw.imageUrl : null,
        latitude: Number.isFinite(raw.latitude) ? raw.latitude : null,
        longitude: Number.isFinite(raw.longitude) ? raw.longitude : null,
        online: false,
        startDate: raw.date ? new Date(`${raw.date}T00:00:00.000Z`) : null,
        endDate: raw.endDate ? new Date(`${raw.endDate}T00:00:00.000Z`) : null,
        startTime: raw.startTime,
        endTime: raw.endTime,
        url: raw.url,
        source: 'mumbaionchain',
        externalId: raw.id,
        isActive: true,
      };
      const event = await prisma.event.upsert({
        where: { slug: row.slug },
        create: row,
        update: row,
      });
      const days = row.startDate && row.endDate ? eachDay(raw.date, raw.endDate || raw.date) : [];
      const multiDay = days.length > 1;
      await prisma.timetableSlot.deleteMany({ where: { eventId: event.id } });
      if (days.length) {
        const result = await prisma.timetableSlot.createMany({
          data: days.map((date, index) => ({
            eventId: event.id,
            date,
            dayNumber: index + 1,
            label: multiDay ? `Day ${index + 1}` : null,
            startTime: multiDay ? null : row.startTime,
            endTime: multiDay ? null : row.endTime,
            allDay: multiDay || !row.startTime,
            title: row.name,
          })),
        });
        slotsCreated += result.count;
      }
      eventsUpserted += 1;
    }
  } finally {
    await prisma.$disconnect();
  }
  return { eventsUpserted, slotsCreated };
}

async function main() {
  const offline = process.argv.includes('--offline');
  const shouldSeed = process.argv.includes('--seed');
  const events = offline ? readSnapshot().events : parseMumbaiOnchainBundle(await fetchBundle());
  if (!events.length) throw new Error('No events were found');
  if (!offline) writeSnapshot(events);
  console.log(`${offline ? 'Read' : 'Saved'} ${events.length} events ${offline ? 'from' : 'to'} scripts/data/mumbaionchain-events.json`);
  if (!shouldSeed) return;
  const result = await seed(events);
  console.log(`Upserted ${result.eventsUpserted} events and ${result.slotsCreated} timetable slots`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
