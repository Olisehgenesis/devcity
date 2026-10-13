import { NextResponse } from 'next/server';
import { authorizeClaim, listClaims } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('userAddress') || '';
  try {
    const claims = await listClaims(userAddress);
    return NextResponse.json({ claims });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load claims' }, { status: error.status || 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dropId, userAddress } = body;
    if (!dropId || !userAddress) {
      return NextResponse.json({ error: 'Missing dropId or userAddress' }, { status: 400 });
    }
    const result = await authorizeClaim(dropId, userAddress, request as any);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const status = error.status || 400;
    const message = error.message || 'Claim authorization failed';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
