import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/presence/update
 * Update user's presence status and location (privacy-safe)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, status, visibility, location } = body;

    if (!userAddress || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const roundedLocation = visibility === 'approximate'
      ? {
          lat: Math.round(location.lat * 100) / 100,
          lng: Math.round(location.lng * 100) / 100,
        }
      : location;

    return NextResponse.json(
      {
        userAddress,
        status,
        visibility,
        location: roundedLocation,
        updatedAt: Date.now(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/presence/nearby
 * Get nearby users (respecting privacy settings)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '1');
    const visibility = searchParams.get('visibility') || 'approximate';

    const nearbyUsers = [
      {
        userAddress: '0x...',
        username: 'genesis',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=genesis',
        status: 'online',
        distance: 0.2,
        location: { lat: lat + 0.001, lng: lng + 0.001 },
      },
    ];

    return NextResponse.json({ nearbyUsers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby users' },
      { status: 500 }
    );
  }
}
