import { NextResponse } from 'next/server';
import { gameLeaderboard, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('userAddress');
    if (!userAddress) throw new ApiError(400, 'userAddress is required');
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 10), 100));
    const leaderboard = await gameLeaderboard(userAddress, limit);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/game/leaderboard', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
