import { NextResponse } from 'next/server';
import { applyGameActions, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.userAddress) throw new ApiError(400, 'userAddress is required');
    const game = await applyGameActions(body.userAddress, {
      touch: body.touch === true,
      awardBadge: body.awardBadge ?? null,
      collectSticker: body.collectSticker ?? null,
      leaderboardsOptIn: typeof body.leaderboardsOptIn === 'boolean' ? body.leaderboardsOptIn : undefined,
    });
    return NextResponse.json({ game });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/game/actions', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
