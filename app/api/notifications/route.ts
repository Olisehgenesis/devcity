import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

// GET /api/notifications - Get user's notifications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    const where: any = { userId: user.id };
    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/notifications', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - Create a notification (internal use)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, type, title, body: notifBody, data } = body;

    if (!userId || !type || !title || !notifBody) {
      throw new ApiError(400, 'userId, type, title, and body are required');
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body: notifBody,
        data: data || undefined,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/notifications', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}