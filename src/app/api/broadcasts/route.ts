import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateUser, createBroadcast, getBroadcasts } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const broadcasts = await getBroadcasts(limit, offset);

    return NextResponse.json(
      {
        broadcasts: broadcasts.map((b) => ({
          id: b.id,
          username: b.user.username,
          avatarUrl: b.user.avatarUrl,
          text: b.text,
          timestamp: b.createdAt.getTime(),
          likes: b.broadcastLikes.length,
          comments: b.broadcastComments.map((c) => ({
            id: c.id,
            username: c.user.username,
            text: c.text,
            timestamp: c.createdAt.getTime(),
          })),
        })),
        total: broadcasts.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch broadcasts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, text } = body;

    if (!userAddress || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await getOrCreateUser(userAddress);
    const broadcast = await createBroadcast(user.id, text);

    return NextResponse.json(
      {
        id: broadcast.id,
        username: broadcast.user.username,
        text: broadcast.text,
        timestamp: broadcast.createdAt.getTime(),
        likes: 0,
        comments: [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json(
      { error: 'Failed to create broadcast' },
      { status: 500 }
    );
  }
}
