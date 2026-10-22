import { NextResponse } from 'next/server';
import { ApiError, listReplies } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { id, commentId } = await params;
    const thread = await listReplies(id, commentId);
    return NextResponse.json(thread);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/broadcasts/[id]/comments/[commentId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
