import { NextResponse } from 'next/server';
import { listActiveDrops, createDrop, ApiError } from '@/lib/db-helpers';

export async function GET() {
  try {
    const drops = await listActiveDrops();
    return NextResponse.json({ drops });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/drops', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const drop = await createDrop({
      name: body.name,
      description: body.description,
      tokenAddress: body.tokenAddress,
      amount: body.amount,
      maxClaimants: body.maxClaimants,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      lat: body.lat,
      lng: body.lng,
      creatorAddress: body.creatorAddress,
    });
    return NextResponse.json({ drop }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/drops', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
