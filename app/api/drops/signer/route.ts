import { NextResponse } from 'next/server';
import { getSignerAddress } from '@/lib/signer';
import { CELO_SEPOLIA } from '@/lib/chain';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      claimAuthority: getSignerAddress(),
      dropClaim: CELO_SEPOLIA.dropClaim,
    });
  } catch (err) {
    console.error('GET /api/drops/signer', err);
    return NextResponse.json({ error: 'Claim signer is not configured.' }, { status: 500 });
  }
}
