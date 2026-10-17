import { NextResponse } from 'next/server';
import { claimStatusForDrops } from '@/lib/claim-status';

export async function GET(request: Request) {
  try {
    const userAddress = new URL(request.url).searchParams.get('userAddress');
    const drops = await claimStatusForDrops(userAddress);
    return NextResponse.json({ drops });
  } catch (error) {
    console.error('GET /api/claims/status', error);
    return NextResponse.json({ error: 'Could not load claim status' }, { status: 500 });
  }
}
