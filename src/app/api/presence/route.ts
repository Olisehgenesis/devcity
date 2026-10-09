import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, updatePresence, getNearbyUsers } from '@/lib/db-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, status, visibility, location } = body;

    if (!userAddress || !status || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await getOrCreateUser(userAddress);
    const presence = await updatePresence(
      user.id,
      location.lat,
      location.lng,
      visibility || 'approximate',
      status
    );

    return NextResponse.json(
      {
        userAddress,
        status,
        visibility: presence.visibility,
        location: {
          lat: presence.latitude,
          lng: presence.longitude,
        },
        updatedAt: presence.lastUpdated.getTime(),
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '1');

    const nearbyUsers = await getNearbyUsers(lat, lng, radius);

    return NextResponse.json({ nearbyUsers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby users' },
      { status: 500 }
    );
  }
}
