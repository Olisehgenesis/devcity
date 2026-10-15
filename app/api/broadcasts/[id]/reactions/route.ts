import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

// GET /api/broadcasts/[id]/reactions - List reactions for a broadcast
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reactions = await prisma.broadcastReaction.findMany({
      where: { broadcastId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    // Group by emoji and count
    const grouped = reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
      }
      acc[r.emoji].count++;
      acc[r.emoji].users.push({
        userId: r.userId,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
      });
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      reactions: Object.values(grouped),
      total: reactions.length,
    });
  } catch (err) {
    console.error('GET /api/broadcasts/[id]/reactions', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/broadcasts/[id]/reactions - Add a reaction
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress, emoji } = body;

    if (!userAddress || !emoji) {
      throw new ApiError(400, 'userAddress and emoji are required');
    }

    const user = await getOrCreateUser(userAddress);
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new ApiError(404, 'Broadcast not found');
    }

    // Check if user already reacted with this emoji
    const existing = await prisma.broadcastReaction.findUnique({
      where: {
        broadcastId_userId_emoji: {
          broadcastId: id,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existing) {
      // Remove the reaction (toggle)
      await prisma.broadcastReaction.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ reacted: false, emoji });
    }

    // Add the reaction
    const reaction = await prisma.broadcastReaction.create({
      data: {
        broadcastId: id,
        userId: user.id,
        emoji,
      },
      include: { user: true },
    });

    return NextResponse.json({ reacted: true, reaction }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/broadcasts/[id]/reactions', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
