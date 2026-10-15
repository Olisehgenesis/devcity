import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/trending - Get trending content (broadcasts, hashtags, events)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get trending broadcasts (most liked + commented in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const trendingBroadcasts = await prisma.broadcast.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
      },
      include: {
        user: { select: { username: true, avatarUrl: true } },
        _count: {
          select: {
            broadcastLikes: true,
            broadcastComments: true,
          },
        },
      },
      orderBy: [
        { broadcastLikes: { _count: 'desc' } },
        { broadcastComments: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Get trending hashtags
    const trendingHashtags = await prisma.hashtag.findMany({
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    // Get trending events (most RSVPs in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingEvents = await prisma.event.findMany({
      where: {
        isActive: true,
        rsvps: {
          some: {
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      include: {
        _count: {
          select: { rsvps: true },
        },
      },
      orderBy: {
        rsvps: { _count: 'desc' },
      },
      take: limit,
    });

    return NextResponse.json({
      broadcasts: trendingBroadcasts.map((b) => ({
        id: b.id,
        text: b.text,
        userId: b.userId,
        username: b.user.username,
        avatarUrl: b.user.avatarUrl,
        likes: b._count.broadcastLikes,
        comments: b._count.broadcastComments,
        createdAt: b.createdAt,
      })),
      hashtags: trendingHashtags,
      events: trendingEvents.map((e) => ({
        id: e.id,
        name: e.name,
        organizer: e.organizer,
        category: e.category,
        startDate: e.startDate,
        rsvpCount: e._count.rsvps,
      })),
    });
  } catch (err) {
    console.error('GET /api/trending', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}