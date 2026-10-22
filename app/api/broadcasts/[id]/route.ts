import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError, syncBroadcastHashtags } from '@/lib/db-helpers';

// GET /api/broadcasts/[id] - Get a single broadcast
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get('userAddress') ?? undefined;

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, avatarUrl: true } },
        _count: {
          select: {
            broadcastLikes: true,
            broadcastComments: true,
          },
        },
      },
    });

    if (!broadcast) {
      throw new ApiError(404, 'Broadcast not found');
    }

    let liked = false;
    if (viewerAddress) {
      const viewer = await getOrCreateUser(viewerAddress);
      const like = await prisma.broadcastLike.findUnique({
        where: { broadcastId_userId: { broadcastId: id, userId: viewer.id } },
      });
      liked = !!like;
    }

    return NextResponse.json({
      broadcast: {
        id: broadcast.id,
        text: broadcast.text,
        mediaUrl: broadcast.mediaUrl,
        userId: broadcast.userId,
        username: broadcast.user.username,
        avatarUrl: broadcast.user.avatarUrl,
        likes: broadcast._count.broadcastLikes,
        liked,
        commentCount: broadcast._count.broadcastComments,
        createdAt: broadcast.createdAt,
        updatedAt: broadcast.updatedAt,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/broadcasts/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/broadcasts/[id] - Edit a broadcast
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress, text, mediaUrl } = body;

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    if (!text || text.length > 240) {
      throw new ApiError(400, 'Text is required and must be 240 chars or less');
    }

    const user = await getOrCreateUser(userAddress);

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new ApiError(404, 'Broadcast not found');
    }

    if (broadcast.userId !== user.id) {
      throw new ApiError(403, 'Not authorized to edit this broadcast');
    }

    // 5-minute edit window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (broadcast.createdAt < fiveMinutesAgo) {
      throw new ApiError(410, 'Edit window has expired (5 minutes)');
    }

    await syncBroadcastHashtags(id, text);
    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        text,
        mediaUrl: mediaUrl || null,
        updatedAt: new Date(),
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
    });

    return NextResponse.json({
      broadcast: {
        id: updated.id,
        text: updated.text,
        mediaUrl: updated.mediaUrl,
        userId: updated.userId,
        username: updated.user.username,
        avatarUrl: updated.user.avatarUrl,
        likes: updated._count.broadcastLikes,
        commentCount: updated._count.broadcastComments,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        edited: true,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('PATCH /api/broadcasts/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/broadcasts/[id] - Delete a broadcast
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
    });

    if (!broadcast) {
      throw new ApiError(404, 'Broadcast not found');
    }

    if (broadcast.userId !== user.id) {
      throw new ApiError(403, 'Not authorized to delete this broadcast');
    }

    await syncBroadcastHashtags(id, '');
    await prisma.broadcast.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('DELETE /api/broadcasts/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}