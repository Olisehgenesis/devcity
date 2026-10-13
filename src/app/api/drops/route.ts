import { NextResponse } from 'next/server';
import { listActiveDrops } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const drops = await listActiveDrops();
    return NextResponse.json({ drops });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load drops' }, { status: error.status || 500 });
  }
}
