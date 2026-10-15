import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/hashtags - List all hashtags
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where = search
      ? { tag: { contains: search.toLowerCase(), mode: 'insensitive' as const } }
      : {};

    const hashtags = await prisma.hashtag.findMany({
      where,
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    return NextResponse.json({ hashtags });
  } catch (err) {
    console.error('GET /api/hashtags', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}