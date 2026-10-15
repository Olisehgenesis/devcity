import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const userId = `user_${userAddress.toLowerCase()}`;

    // Verify the notification belongs to this user
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/notifications/[id]/read', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}