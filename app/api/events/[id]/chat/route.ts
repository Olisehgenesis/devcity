import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

// GET /api/events/[id]/chat - Get event chat messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // cursor for pagination

    const where: any = { eventId: id };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.eventMessage.findMany({
      where,
      include: {
        user: { select: { username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        text: m.text,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        createdAt: m.createdAt,
      })),
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error('GET /api/events/[id]/chat', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/events/[id]/chat - Send a message to event chat
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress, text } = body;

    if (!userAddress || !text) {
      throw new ApiError(400, 'userAddress and text are required');
    }

    if (text.length > 500) {
      throw new ApiError(400, 'Message too long (max 500 chars)');
    }

    const user = await getOrCreateUser(userAddress);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new ApiError(404, 'Event not found');
    }

    const message = await prisma.eventMessage.create({
      data: {
        eventId: id,
        userId: user.id,
        text,
      },
      include: {
        user: { select: { username: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        text: message.text,
        userId: message.userId,
        username: message.user.username,
        avatarUrl: message.user.avatarUrl,
        createdAt: message.createdAt,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/events/[id]/chat', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}