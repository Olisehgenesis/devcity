import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notifications/read-all - Mark all notifications as read
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const userId = `user_${userAddress.toLowerCase()}`;

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/read-all', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}