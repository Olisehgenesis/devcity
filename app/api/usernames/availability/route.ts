import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeUsername } from '@/lib/usernames';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rawUsername = new URL(request.url).searchParams.get('username') ?? '';
  const username = normalizeUsername(rawUsername);
  if (!username) {
    return NextResponse.json(
      { available: false, error: 'Use 3–24 letters, numbers, or hyphens; start and end with a letter or number.' },
      { status: 400 },
    );
  }

  try {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
      prisma.profile.findUnique({ where: { username }, select: { id: true } }),
    ]);
    return NextResponse.json({ username, available: !user && !profile });
  } catch (error) {
    console.error('GET /api/usernames/availability failed:', error);
    return NextResponse.json({ error: 'Could not check username availability.' }, { status: 500 });
  }
}
