import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/leaderboards - Get various leaderboards
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // drops, tips, followers, activity, all
    const limit = parseInt(searchParams.get('limit') || '10');

    const leaderboards: any = {};

    // Most drops claimed
    if (type === 'all' || type === 'drops') {
      const topClaimers = await prisma.dropClaim.groupBy({
        by: ['userId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      const claimerDetails = await Promise.all(
        topClaimers.map(async (c) => {
          const user = await prisma.user.findUnique({
            where: { id: c.userId },
            select: { username: true, avatarUrl: true, walletAddress: true },
          });
          return {
            rank: 0,
            userId: c.userId,
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatarUrl,
            walletAddress: user?.walletAddress,
            count: c._count.id,
          };
        })
      );

      leaderboards.dropsClaimed = claimerDetails.map((c, i) => ({ ...c, rank: i + 1 }));
    }

    // Most tips sent
    if (type === 'all' || type === 'tips') {
      const topTippers = await prisma.tip.groupBy({
        by: ['fromUserId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      const tipperDetails = await Promise.all(
        topTippers.map(async (t) => {
          const user = await prisma.user.findUnique({
            where: { id: t.fromUserId },
            select: { username: true, avatarUrl: true, walletAddress: true },
          });
          return {
            rank: 0,
            userId: t.fromUserId,
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatarUrl,
            walletAddress: user?.walletAddress,
            count: t._count.id,
          };
        })
      );

      leaderboards.tipsSent = tipperDetails.map((c, i) => ({ ...c, rank: i + 1 }));
    }

    // Most followers
    if (type === 'all' || type === 'followers') {
      const topUsers = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          walletAddress: true,
          _count: { select: { followers: true } },
        },
        orderBy: { followers: { _count: 'desc' } },
        take: limit,
      });

      leaderboards.followers = topUsers.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        walletAddress: u.walletAddress,
        count: u._count.followers,
      }));
    }

    // Most active (broadcasts)
    if (type === 'all' || type === 'activity') {
      const topBroadcasters = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          walletAddress: true,
          _count: { select: { broadcasts: true } },
        },
        orderBy: { broadcasts: { _count: 'desc' } },
        take: limit,
      });

      leaderboards.activity = topBroadcasters.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        walletAddress: u.walletAddress,
        count: u._count.broadcasts,
      }));
    }

    return NextResponse.json({ leaderboards });
  } catch (err) {
    console.error('GET /api/leaderboards', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}