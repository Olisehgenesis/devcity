import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

// GET /api/export - Export user data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    // Gather all user data
    const [
      profile,
      broadcasts,
      broadcastLikes,
      broadcastComments,
      tipsSent,
      tipsReceived,
      rsvps,
      claims,
      tokens,
      following,
      followers,
      settings,
      activity,
    ] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id } }),
      prisma.broadcast.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.broadcastLike.findMany({ where: { userId: user.id } }),
      prisma.broadcastComment.findMany({ where: { userId: user.id } }),
      prisma.tip.findMany({ where: { fromUserId: user.id } }),
      prisma.tip.findMany({ where: { toUserId: user.id } }),
      prisma.eventRsvp.findMany({ where: { userId: user.id } }),
      prisma.dropClaim.findMany({ where: { userId: user.id } }),
      prisma.token.findMany({ where: { creatorId: user.id } }),
      prisma.follow.findMany({ where: { followerId: user.id } }),
      prisma.follow.findMany({ where: { followingId: user.id } }),
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
      prisma.userActivity.findMany({ where: { userId: user.id } }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      profile,
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        text: b.text,
        mediaUrl: b.mediaUrl,
        createdAt: b.createdAt,
      })),
      broadcastLikes: broadcastLikes.map((l) => ({
        broadcastId: l.broadcastId,
        createdAt: l.createdAt,
      })),
      broadcastComments: broadcastComments.map((c) => ({
        id: c.id,
        broadcastId: c.broadcastId,
        text: c.text,
        createdAt: c.createdAt,
      })),
      tipsSent: tipsSent.map((t) => ({
        id: t.id,
        toUserId: t.toUserId,
        amount: t.amount.toString(),
        message: t.message,
        txHash: t.txHash,
        createdAt: t.createdAt,
      })),
      tipsReceived: tipsReceived.map((t) => ({
        id: t.id,
        fromUserId: t.fromUserId,
        amount: t.amount.toString(),
        message: t.message,
        txHash: t.txHash,
        createdAt: t.createdAt,
      })),
      eventRsvps: rsvps.map((r) => ({
        eventId: r.eventId,
        status: r.status,
        createdAt: r.createdAt,
      })),
      claims: claims.map((c) => ({
        dropId: c.dropId,
        amount: c.amount.toString(),
        status: c.status,
        txHash: c.txHash,
        claimedAt: c.claimedAt,
      })),
      tokensCreated: tokens.map((t) => ({
        name: t.name,
        symbol: t.symbol,
        contractAddress: t.contractAddress,
        maxSupply: t.maxSupply.toString(),
        createdAt: t.createdAt,
      })),
      following: following.map((f) => f.followingId),
      followers: followers.map((f) => f.followerId),
      settings,
      activity: activity.map((a) => ({
        kind: a.kind,
        text: a.text,
        refId: a.refId,
        timestamp: a.timestamp,
      })),
    };

    return NextResponse.json(exportData);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/export', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}