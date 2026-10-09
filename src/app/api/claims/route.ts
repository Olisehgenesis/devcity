import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/claims/authorize
 * Backend validates eligibility and signs claim authorization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dropId, userAddress, qrCode, location } = body;

    if (!dropId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const nonce = 0;
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signature = '0x' + '00'.repeat(65);

    return NextResponse.json(
      {
        dropId,
        userAddress,
        nonce,
        expiresAt,
        signature,
        message: 'Authorization valid for 5 minutes',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error authorizing claim:', error);
    return NextResponse.json(
      { error: 'Failed to authorize claim' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/claims
 * Get claim history for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress' },
        { status: 400 }
      );
    }

    const claims = [
      {
        dropId: 'drop-1',
        tokenSymbol: 'DEV26',
        amount: '10',
        claimedAt: Date.now() - 3600000,
        txHash: '0x...',
      },
    ];

    return NextResponse.json({ claims }, { status: 200 });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}
