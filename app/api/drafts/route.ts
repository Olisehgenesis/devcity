import { NextResponse } from 'next/server';
import { ApiError, listDrafts, saveDraft } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userAddress = new URL(request.url).searchParams.get('userAddress') ?? '';
    const drafts = await listDrafts(userAddress);
    return NextResponse.json({ drafts });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/drafts', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const draft = await saveDraft(body.userAddress, String(body.text ?? ''), body.mediaUrl, body.id);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/drafts', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
