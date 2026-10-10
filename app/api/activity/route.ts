import { NextResponse } from 'next/server';
import { listActivity, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') ?? '';
    const activity = await listActivity(userAddress);
    return NextResponse.json({ activity });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/activity', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
