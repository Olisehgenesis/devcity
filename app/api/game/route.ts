import { NextResponse } from 'next/server';
import { getGameProfile, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('userAddress');
    if (!userAddress) throw new ApiError(400, 'userAddress is required');
    const game = await getGameProfile(userAddress);
    return NextResponse.json({ game });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/game', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
