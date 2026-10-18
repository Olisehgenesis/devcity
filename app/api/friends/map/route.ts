import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { friendMap } from '@/lib/friends';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ friends: [] });
  const friends = await friendMap(userId);
  return NextResponse.json({ friends });
}
