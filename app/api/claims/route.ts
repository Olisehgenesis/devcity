import { NextResponse } from 'next/server';
import { listClaims, ApiError } from '@/lib/db-helpers';

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
