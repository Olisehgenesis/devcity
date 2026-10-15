import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

// GET /api/events/[id]/rsvp - Get event RSVPs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // going, interested, attended

    const where: any = { eventId: id };
    if (status) {
      where.status = status;
    }

    const rsvps = await prisma.eventRsvp.findMany({
      where,
      include: {
        user: { select: { username: true, avatarUrl: true, walletAddress: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const counts = await prisma.eventRsvp.groupBy({
      by: ['status'],
      where: { eventId: id },
      _count: true,
    });

    return NextResponse.json({
      rsvps: rsvps.map((r) => ({
        userId: r.userId,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl,
        walletAddress: r.user.walletAddress,
        status: r.status,
        createdAt: r.createdAt,
      })),
      counts: counts.reduce((acc, c) => {
        acc[c.status] = c._count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (err) {
    console.error('GET /api/events/[id]/rsvp', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/events/[id]/rsvp - RSVP to an event
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress, status } = body;

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new ApiError(404, 'Event not found');
    }

    const validStatuses = ['going', 'interested', 'attended'];
    const rsvpStatus = validStatuses.includes(status) ? status : 'going';

    const rsvp = await prisma.eventRsvp.upsert({
      where: {
        eventId_userId: { eventId: id, userId: user.id },
      },
      create: {
        eventId: id,
        userId: user.id,
        status: rsvpStatus,
      },
      update: {
        status: rsvpStatus,
      },
    });

    return NextResponse.json({ rsvp }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/events/[id]/rsvp', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/events/[id]/rsvp - Cancel RSVP
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

    await prisma.eventRsvp.delete({
      where: {
        eventId_userId: { eventId: id, userId: user.id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('DELETE /api/events/[id]/rsvp', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}