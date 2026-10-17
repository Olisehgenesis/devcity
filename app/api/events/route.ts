import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
        location: 'Mumbai',
        region: 'Mumbai',
        kind: 'community',
        source: 'devcity',
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
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
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
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
