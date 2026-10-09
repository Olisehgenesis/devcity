import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/broadcasts
 * Get city feed (broadcasts from nearby users)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const broadcasts = [
      {
        id: 'broadcast-1',
        userAddress: '0x...',
        username: 'genesis',
        avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=genesis',
        text: 'Just claimed DEV26! This event is amazing 🚀',
        timestamp: Date.now() - 300000,
        likes: 12,
        liked: false,
        comments: [
          {
            id: 'comment-1',
            username: 'alice',
            text: 'Nice! See you at the next drop',
            timestamp: Date.now() - 60000,
          },
        ],
      },
    ];

    return NextResponse.json({ broadcasts, total: 1 }, { status: 200 });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch broadcasts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/broadcasts
 * Create a new broadcast
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, text, eventId } = body;

    if (!userAddress || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const broadcast = {
      id: `broadcast-${Date.now()}`,
      userAddress,
      text: text.slice(0, 240),
      eventId,
      timestamp: Date.now(),
      likes: 0,
      comments: [],
    };

    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json(
      { error: 'Failed to create broadcast' },
      { status: 500 }
    );
  }
}
