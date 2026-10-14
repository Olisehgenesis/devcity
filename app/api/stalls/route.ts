import { NextResponse } from 'next/server';
import { listStalls, createStall, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');
    const radiusKm = url.searchParams.get('radiusKm');
    const stalls = await listStalls({
      lat: lat != null ? Number(lat) : undefined,
      lng: lng != null ? Number(lng) : undefined,
      radiusKm: radiusKm != null ? Number(radiusKm) : undefined,
    });
    return NextResponse.json({ stalls });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/stalls', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const stall = await createStall({
      ownerId: body.ownerId,
      name: body.name,
      description: body.description,
      lat: body.lat,
      lng: body.lng,
      radiusM: body.radiusM,
      imageUrl: body.imageUrl,
      tags: body.tags,
    });
    return NextResponse.json({ stall }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/stalls', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
