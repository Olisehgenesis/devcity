import { NextResponse } from 'next/server';
import { listExplore } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userAddress = new URL(request.url).searchParams.get('userAddress') ?? undefined;
    const explore = await listExplore(userAddress || undefined);
    return NextResponse.json(explore);
  } catch (err) {
    console.error('GET /api/explore', err);
    return NextResponse.json({ error: 'Could not load explore.' }, { status: 500 });
  }
}
