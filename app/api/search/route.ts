import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const type = searchParams.get('type') || 'all'; // all, users, broadcasts, events, hashtags
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      throw new ApiError(400, 'Search query must be at least 2 characters');
    }

    // Allow searching by handle like "oliseh.devcity" or "oliseh.devcity.fun"
    const handleQuery = query
      .toLowerCase()
      .replace(/\.devcity\.fun$/i, '')
      .replace(/\.devcity$/i, '')
      .trim();

    const results: any = {
      users: [],
      broadcasts: [],
      events: [],
      hashtags: [],
    };

    // Search users
    if (type === 'all' || type === 'users') {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: handleQuery, mode: 'insensitive' } },
            { name: { contains: handleQuery, mode: 'insensitive' } },
            { email: { contains: handleQuery, mode: 'insensitive' } },
            { walletAddress: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          walletAddress: true,
        },
      });
      results.users = users;
    }

    // Search broadcasts
    if (type === 'all' || type === 'broadcasts') {
      const broadcasts = await prisma.broadcast.findMany({
        where: {
          text: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              broadcastLikes: true,
              broadcastComments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      results.broadcasts = broadcasts.map((b) => ({
        id: b.id,
        text: b.text,
        createdAt: b.createdAt.toISOString(),
        user: b.user,
        likes: b._count.broadcastLikes,
        comments: b._count.broadcastComments,
      }));
    }

    // Search events
    if (type === 'all' || type === 'events') {
      const events = await prisma.event.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { organizer: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { startDate: 'asc' },
      });
      results.events = events.map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        organizer: e.organizer,
        summary: e.summary,
        category: e.category,
        location: e.location,
        startDate: e.startDate,
        startTime: e.startTime,
        url: e.url,
      }));
    }

    // Extract hashtags from broadcasts (basic implementation)
    if (type === 'all' || type === 'hashtags') {
      const hashtagRegex = /#(\w+)/g;
      const hashtags = new Set<string>();

      const broadcasts = await prisma.broadcast.findMany({
        where: {
          text: { contains: query, mode: 'insensitive' },
        },
        take: 100,
        select: { text: true },
      });

      broadcasts.forEach((b) => {
        const matches = b.text.match(hashtagRegex);
        if (matches) {
          matches.forEach((tag) => {
            const cleanTag = tag.toLowerCase().replace('#', '');
            if (cleanTag.includes(query.toLowerCase())) {
              hashtags.add(cleanTag);
            }
          });
        }
      });

      results.hashtags = Array.from(hashtags).slice(0, limit);
    }

    return NextResponse.json({
      query,
      results: type === 'all' ? results : { [type]: results[type as keyof typeof results] },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/search', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
