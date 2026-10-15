import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/users/suggestions - Get suggested users to follow
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const userId = `user_${userAddress.toLowerCase()}`;

    // Get users this user already follows
    const existingFollows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = existingFollows.map((f) => f.followingId);
    const excludeIds = [...followingIds, userId];

    // Get suggested users: those with most followers, activity, or nearby presence
    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        broadcasts: { some: {} }, // Only users who have posted
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        _count: {
          select: {
            broadcasts: true,
            followers: true,
          },
        },
      },
      orderBy: [
        { followers: { _count: 'desc' } },
        { broadcasts: { _count: 'desc' } },
      ],
      take: limit,
    });

    // Get presence data for nearby suggestions
    const suggestionsWithPresence = await Promise.all(
      suggestions.map(async (user) => {
        const presence = await prisma.presence.findUnique({
          where: { userId: user.id },
        });
        return {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          broadcastCount: user._count.broadcasts,
          followerCount: user._count.followers,
          isOnline: presence?.status === 'ONLINE',
          latitude: presence?.latitude ? parseFloat(presence.latitude.toString()) : null,
          longitude: presence?.longitude ? parseFloat(presence.longitude.toString()) : null,
        };
      })
    );

    return NextResponse.json({ suggestions: suggestionsWithPresence });
  } catch (err) {
    console.error('GET /api/users/suggestions', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}