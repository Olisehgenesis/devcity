import { NextResponse } from 'next/server';
import { confirmClaim, listClaims, ApiError } from '@/lib/db-helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { dropId?: string; userAddress?: string; txHash?: string } | null;
    const claim = await confirmClaim({
      dropId: body?.dropId ?? '',
      userAddress: body?.userAddress ?? '',
      txHash: body?.txHash ?? '',
    });
    return NextResponse.json({ claim });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/claims', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') ?? '';
    const claims = await listClaims(userAddress);
    return NextResponse.json({ claims });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/claims', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
