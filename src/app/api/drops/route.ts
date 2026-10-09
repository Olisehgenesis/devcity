import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/drops
 * List all active drops with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');

    const drops = [
      {
        id: 'drop-1',
        tokenId: 'token-dev26',
        tokenSymbol: 'DEV26',
        tokenIconUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=dev26',
        totalAmount: '1000',
        amountPerClaim: '10',
        maxClaimants: 100,
        currentClaimants: 45,
        location: { lat: -1.2921, lng: 36.8219 },
        expiresAt: Date.now() + 86400000,
        qrCode: 'https://example.com/qr/drop-1',
        eligibility: 'qr',
      },
    ];

    return NextResponse.json({ drops }, { status: 200 });
  } catch (error) {
    console.error('Error fetching drops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drops' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drops
 * Create a new drop (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, amountPerClaim, maxClaimants, expiresAt, location, eligibility } = body;

    const drop = {
      id: `drop-${Date.now()}`,
      tokenId,
      amountPerClaim,
      maxClaimants,
      currentClaimants: 0,
      expiresAt,
      location,
      eligibility,
      createdAt: Date.now(),
    };

    return NextResponse.json({ drop }, { status: 201 });
  } catch (error) {
    console.error('Error creating drop:', error);
    return NextResponse.json(
      { error: 'Failed to create drop' },
      { status: 500 }
    );
  }
}
