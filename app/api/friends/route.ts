import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FriendError, listFriendDesk, respondToFriendRequest, sendFriendRequest } from '@/lib/friends';

export const dynamic = 'force-dynamic';

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await sessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to see friend requests.' }, { status: 401 });
  const desk = await listFriendDesk(userId);
  return NextResponse.json(desk);
}

export async function POST(request: Request) {
  const userId = await sessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to send a friend request.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { username?: string; requestId?: string; action?: string } | null;
  try {
    if (body?.requestId && (body.action === 'accept' || body.action === 'decline')) {
      const result = await respondToFriendRequest(userId, body.requestId, body.action);
      return NextResponse.json(result);
    }
    const result = await sendFriendRequest(userId, String(body?.username ?? ''));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FriendError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('POST /api/friends', error instanceof Error ? error.name : 'error');
    return NextResponse.json({ error: 'Could not update that friend request.' }, { status: 500 });
  }
}
