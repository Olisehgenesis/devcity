import { NextResponse } from 'next/server';
import { nearbyPresence, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    const radius = Number(searchParams.get('radius'));
    const users = await nearbyPresence(lat, lng, radius);
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/presence/nearby', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
