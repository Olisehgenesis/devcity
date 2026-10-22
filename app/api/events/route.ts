import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEVCON_VENUE = { lat: 19.0669, lng: 72.8685 };

function officialDevcon(event: { name: string; category: string | null }) {
  return event.category === 'devcon' || /^devcon 8\b/i.test(event.name);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (name.length < 2) return NextResponse.json({ error: 'Name the event.' }, { status: 400 });
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
    const event = await prisma.event.create({
      data: {
        slug: `${slugBase}-${Date.now().toString(36)}`,
        name,
        organizer: 'DEVCITY',
        location: null,
        region: null,
        kind: 'community',
        source: 'devcity',
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        startDate: (() => {
          if (!body.startDate) return null;
          const parsed = new Date(String(body.startDate));
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        })(),
        startTime: body.startTime ? String(body.startTime) : null,
        endTime: body.endTime ? String(body.endTime) : null,
      },
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events failed:', error);
    return NextResponse.json({ error: 'Could not create the event.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { isActive: true },
      include: { timetable: { orderBy: [{ date: 'asc' }, { startTime: 'asc' }] } },
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        name: event.name,
        organizer: event.organizer,
        summary: event.summary,
        category: event.category,
        kind: event.kind,
        region: event.region,
        imageUrl: event.imageUrl,
        latitude: officialDevcon(event) ? DEVCON_VENUE.lat : event.latitude,
        longitude: officialDevcon(event) ? DEVCON_VENUE.lng : event.longitude,
        location: officialDevcon(event) ? 'Jio World Centre, BKC' : event.location,
        online: event.online,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        url: event.url,
        timetable: event.timetable.map((slot) => ({
          id: slot.id,
          date: slot.date,
          dayNumber: slot.dayNumber,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          allDay: slot.allDay,
          title: slot.title,
        })),
      })),
    });
  } catch (error) {
    console.error('GET /api/events failed:', error);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
