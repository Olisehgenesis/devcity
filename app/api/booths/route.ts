import { NextResponse } from 'next/server';
import { listBooths, createBooth, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');
    const radiusKm = url.searchParams.get('radiusKm');
    const eventId = url.searchParams.get('eventId') ?? undefined;
    const booths = await listBooths({
      lat: lat != null ? Number(lat) : undefined,
      lng: lng != null ? Number(lng) : undefined,
      radiusKm: radiusKm != null ? Number(radiusKm) : undefined,
      eventId,
    });
    return NextResponse.json({ booths });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/booths', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const booth = await createBooth({
      ownerId: body.ownerId,
      stallId: body.stallId,
      eventId: body.eventId,
      name: body.name,
      description: body.description,
      lat: body.lat,
      lng: body.lng,
      radiusM: body.radiusM,
      imageUrl: body.imageUrl,
    });
    return NextResponse.json({ booth }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/booths', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
