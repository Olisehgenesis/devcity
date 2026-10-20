import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { followUser, unfollowUser, listFollowing, listFollowers, ApiError } from '@/lib/db-helpers';

async function sessionWallet(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletAddress: true },
  });
  return user?.walletAddress ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const type = url.searchParams.get('type') ?? 'following';
    if (!address) return NextResponse.json({ error: 'address is required' }, { status: 400 });
    const rows = type === 'followers' ? await listFollowers(address) : await listFollowing(address);
    return NextResponse.json({ [type]: rows });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('GET /api/follows', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const followerAddress = await sessionWallet(request);
    if (!followerAddress) return NextResponse.json({ error: 'Sign in with a wallet before following someone.' }, { status: 401 });
    const body = await request.json();
    const result = await followUser(followerAddress, body.followingAddress);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('POST /api/follows', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const followerAddress = await sessionWallet(request);
    const followingAddress = url.searchParams.get('followingAddress');
    if (!followerAddress) return NextResponse.json({ error: 'Sign in with a wallet before unfollowing someone.' }, { status: 401 });
    if (!followingAddress) {
      return NextResponse.json({ error: 'followingAddress is required' }, { status: 400 });
    }
    const result = await unfollowUser(followerAddress, followingAddress);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('DELETE /api/follows', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
