import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeUsername } from '@/lib/usernames';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase().replace(/^@/, '');
  const people = await prisma.user.findMany({
    where: {
      username: q
        ? { startsWith: q, mode: 'insensitive' }
        : { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 24,
    select: { username: true, avatarUrl: true },
  });
  return NextResponse.json({
    people: people.flatMap((person) => {
      const username = person.username ? normalizeUsername(person.username) : null;
      if (!username) return [];
      return [{ username, avatarUrl: person.avatarUrl }];
    }).slice(0, 6),
  });
}
