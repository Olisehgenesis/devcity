import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listActiveDrops } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    let drops;
    if (eventId) {
      drops = await prisma.drop.findMany({
        where: {
          eventId,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: { token: true, event: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      drops = await listActiveDrops();
    }

    return NextResponse.json(
      {
        drops: drops.map((d) => ({
          id: d.id,
          tokenSymbol: d.token.symbol,
          amount: d.amount.toString(),
          maxClaimants: d.maxClaimants,
          currentClaimants: d.currentClaimants,
          expiresAt: d.expiresAt.getTime(),
          location: {
            lat: d.latitude,
            lng: d.longitude,
          },
          radius: d.radius,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching drops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drops' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, amount, maxClaimants, location, radius, expiresAt } = body;

    if (!tokenId || !amount || !maxClaimants || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const drop = await prisma.drop.create({
      data: {
        tokenId,
        amount: BigInt(amount),
        maxClaimants,
        currentClaimants: 0,
        latitude: location.lat,
        longitude: location.lng,
        radius: radius || 0.5,
        expiresAt: new Date(expiresAt || Date.now() + 3600000),
      },
      include: { token: true },
    });

    return NextResponse.json(
      {
        id: drop.id,
        tokenSymbol: drop.token.symbol,
        amount: drop.amount.toString(),
        maxClaimants: drop.maxClaimants,
        currentClaimants: drop.currentClaimants,
        expiresAt: drop.expiresAt.getTime(),
        location: {
          lat: drop.latitude,
          lng: drop.longitude,
        },
        radius: drop.radius,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating drop:', error);
    return NextResponse.json(
      { error: 'Failed to create drop' },
      { status: 500 }
    );
  }
}
