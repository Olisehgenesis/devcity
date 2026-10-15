import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/hashtags/[tag] - Get broadcasts for a specific hashtag
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const hashtag = await prisma.hashtag.findUnique({
      where: { tag: tag.toLowerCase() },
    });

    if (!hashtag) {
      return NextResponse.json({ error: 'Hashtag not found' }, { status: 404 });
    }

    const broadcasts = await prisma.broadcast.findMany({
      where: {
        broadcastHashtags: {
          some: { hashtagId: hashtag.id },
        },
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
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      hashtag,
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        text: b.text,
        userId: b.userId,
        username: b.user.username,
        avatarUrl: b.user.avatarUrl,
        likes: b._count.broadcastLikes,
        comments: b._count.broadcastComments,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /api/hashtags/[tag]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}