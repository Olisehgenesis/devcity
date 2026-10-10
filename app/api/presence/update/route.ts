import { NextResponse } from 'next/server';
import { updatePresence, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const presence = await updatePresence({
      userAddress: body.userAddress,
      status: body.status,
      lat: body.lat,
      lng: body.lng,
      visibility: body.visibility,
    });
    return NextResponse.json({ presence });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/presence/update', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
