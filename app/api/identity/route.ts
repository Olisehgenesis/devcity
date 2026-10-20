import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api-error';
import { normalizeWalletAddress } from '@/lib/wallet-address';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const address = new URL(request.url).searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'address is required' }, { status: 400 });
    const walletAddress = normalizeWalletAddress(address);
    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
      select: { username: true, name: true, avatarUrl: true, walletAddress: true, createdAt: true },
    });
    return NextResponse.json({
      address: walletAddress,
      username: user?.username ?? null,
      displayName: user?.name || user?.username || null,
      avatar: user?.avatarUrl ?? null,
      joinedAt: user?.createdAt.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not resolve that identity.' }, { status: 500 });
  }
}
