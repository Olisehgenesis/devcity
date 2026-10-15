import { NextResponse } from 'next/server';
import { listStories, createStory, ApiError } from '@/lib/db-helpers';

export async function GET() {
  try {
    const stories = await listStories();
    return NextResponse.json({ stories });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/stories', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const story = await createStory(body.userAddress, body.content, body.mediaUrl);
    return NextResponse.json({ story }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('POST /api/stories', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
