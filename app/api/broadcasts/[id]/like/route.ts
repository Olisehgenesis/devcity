import { NextResponse } from 'next/server';
import { toggleLike, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const broadcast = await toggleLike(id, body.userAddress);
    return NextResponse.json({ broadcast });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/broadcasts/[id]/like', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
