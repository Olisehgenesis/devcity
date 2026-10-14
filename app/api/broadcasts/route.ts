import { NextResponse, type NextRequest } from 'next/server';
import { listBroadcasts, createBroadcast, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get('userAddress') ?? undefined;
    const broadcasts = await listBroadcasts(viewerAddress);
    return NextResponse.json({ broadcasts });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/broadcasts', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const broadcast = await createBroadcast(body.userAddress, body.text, request);
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/broadcasts', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
