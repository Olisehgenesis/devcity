import { NextResponse } from 'next/server';
import { followUser, unfollowUser, listFollowing, listFollowers, ApiError } from '@/lib/db-helpers';

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
    const body = await request.json();
    const result = await followUser(body.followerAddress, body.followingAddress);
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
    const followerAddress = url.searchParams.get('followerAddress');
    const followingAddress = url.searchParams.get('followingAddress');
    if (!followerAddress || !followingAddress) {
      return NextResponse.json({ error: 'followerAddress and followingAddress are required' }, { status: 400 });
    }
    const result = await unfollowUser(followerAddress, followingAddress);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('DELETE /api/follows', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
