import { NextRequest, NextResponse } from 'next/server';
import { authorizeClaim, ApiError } from '@/lib/db-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature, dropId, dropIdBytes32, claimer, nonce, amount, expiresAt } = await authorizeClaim(
      body.dropId,
      body.userAddress,
      request
    );
    return NextResponse.json({ signature, dropId, dropIdBytes32, claimer, nonce, amount, expiresAt });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/claims/authorize', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}