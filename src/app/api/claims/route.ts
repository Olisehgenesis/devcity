import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateUser, hasUserClaimed } from '@/lib/db-helpers';
import { signClaimAuthorization } from '@/lib/signer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dropId, userAddress } = body;

    if (!dropId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await getOrCreateUser(userAddress);
    const alreadyClaimed = await hasUserClaimed(user.id, dropId);
    
    if (alreadyClaimed) {
      return NextResponse.json(
        { error: 'User has already claimed from this drop' },
        { status: 400 }
      );
    }

    const drop = await prisma.drop.findUnique({
      where: { id: dropId },
      include: { token: true },
    });

    if (!drop) {
      return NextResponse.json(
        { error: 'Drop not found or expired' },
        { status: 404 }
      );
    }

    if (drop.currentClaimants >= drop.maxClaimants) {
      return NextResponse.json(
        { error: 'Drop is full' },
        { status: 400 }
      );
    }

    const nonce = 0;
    const expiresAt = Math.floor(Date.now() / 1000) + 300;

    const signature = await signClaimAuthorization(
      dropId,
      userAddress,
      nonce,
      expiresAt
    );

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

    const user = await prisma.user.findUnique({
      where: { walletAddress: userAddress },
    });

    if (!user) {
      return NextResponse.json({ claims: [] }, { status: 200 });
    }

    const claims = await prisma.claim.findMany({
      where: { userId: user.id },
      include: { drop: true, token: true },
      orderBy: { claimedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(
      {
        claims: claims.map((c) => ({
          dropId: c.dropId,
          tokenSymbol: c.token.symbol,
          amount: c.amount.toString(),
          claimedAt: c.claimedAt.getTime(),
          txHash: c.txHash,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}
