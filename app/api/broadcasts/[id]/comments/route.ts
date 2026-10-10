import { NextResponse } from 'next/server';
import { addComment, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const broadcast = await addComment(id, body.userAddress, body.text);
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/broadcasts/[id]/comments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
