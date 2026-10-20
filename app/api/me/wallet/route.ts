import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError } from '@/lib/api-error';
import { linkSessionWallet } from '@/lib/session-wallet';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Sign in to link this wallet.' }, { status: 401 });
    const body = await request.json().catch(() => null) as { userAddress?: string } | null;
    const linked = await linkSessionWallet(userId, body?.userAddress ?? '');
    return NextResponse.json(linked);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/me/wallet', err);
    return NextResponse.json({ error: 'Could not link this wallet.' }, { status: 500 });
  }
}
