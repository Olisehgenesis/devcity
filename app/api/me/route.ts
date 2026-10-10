import { NextResponse } from 'next/server';
import { getMe, updateMe, ApiError } from '@/lib/db-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') ?? '';
    const data = await getMe(userAddress);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/me', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const data = await updateMe({
      userAddress: body.userAddress,
      avatarMode: body.avatarMode,
      avatarSeed: body.avatarSeed,
      avatarImageData: body.avatarImageData,
      visibility: body.visibility,
      presenceStatus: body.presenceStatus,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('PATCH /api/me', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
