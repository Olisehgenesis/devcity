import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const handle = username.trim().toLowerCase();
  if (!handle) return NextResponse.json({ error: 'A username is required.' }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: 'insensitive' } },
    select: { id: true, username: true, name: true, avatarUrl: true, walletAddress: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: 'No one uses that name.' }, { status: 404 });

  const session = await auth.api.getSession({ headers: request.headers });
  const viewer = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    : null;

  const [following, posts, followRow] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { username: true, name: true, avatarUrl: true, walletAddress: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.broadcast.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, text: true, createdAt: true },
    }),
    viewer
      ? prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } },
        select: { id: true },
      })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    username: user.username,
    displayName: user.name || user.username,
    avatar: user.avatarUrl,
    address: user.walletAddress,
    joinedAt: user.createdAt.toISOString(),
    viewerFollows: Boolean(followRow),
    following: following.map((row) => ({
      username: row.following.username,
      displayName: row.following.name || row.following.username,
      avatar: row.following.avatarUrl,
      address: row.following.walletAddress,
    })),
    posts: posts.map((post) => ({
      id: post.id,
      text: post.text,
      createdAt: post.createdAt.toISOString(),
    })),
  });
}
