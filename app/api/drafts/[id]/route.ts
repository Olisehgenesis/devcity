import { NextResponse } from 'next/server';
import { ApiError, deleteDraft, saveDraft } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const draft = await saveDraft(body.userAddress, String(body.text ?? ''), body.mediaUrl, id);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('PATCH /api/drafts/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userAddress = new URL(request.url).searchParams.get('userAddress') ?? '';
    await deleteDraft(userAddress, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('DELETE /api/drafts/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
