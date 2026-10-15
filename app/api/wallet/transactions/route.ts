import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

// GET /api/wallet/transactions - Get user's transaction history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // tips, claims, tokens, all

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);

    const transactions: any[] = [];

    // Get tips sent
    if (!type || type === 'all' || type === 'tips') {
      const tipsSent = await prisma.tip.findMany({
        where: { fromUserId: user.id },
        include: {
          toUser: { select: { username: true, avatarUrl: true, walletAddress: true } },
          token: { select: { symbol: true, iconUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      tipsSent.forEach((t) => {
        transactions.push({
          id: t.id,
          type: 'tip_sent',
          amount: t.amount.toString(),
          tokenSymbol: t.token.symbol,
          tokenIconUrl: t.token.iconUrl,
          counterparty: t.toUser.username,
          counterpartyAddress: t.toUser.walletAddress,
          txHash: t.txHash,
          message: t.message,
          createdAt: t.createdAt,
        });
      });
    }

    // Get tips received
    if (!type || type === 'all' || type === 'tips') {
      const tipsReceived = await prisma.tip.findMany({
        where: { toUserId: user.id },
        include: {
          fromUser: { select: { username: true, avatarUrl: true, walletAddress: true } },
          token: { select: { symbol: true, iconUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      tipsReceived.forEach((t) => {
        transactions.push({
          id: t.id,
          type: 'tip_received',
          amount: t.amount.toString(),
          tokenSymbol: t.token.symbol,
          tokenIconUrl: t.token.iconUrl,
          counterparty: t.fromUser.username,
          counterpartyAddress: t.fromUser.walletAddress,
          txHash: t.txHash,
          message: t.message,
          createdAt: t.createdAt,
        });
      });
    }

    // Get claims
    if (!type || type === 'all' || type === 'claims') {
      const claims = await prisma.dropClaim.findMany({
        where: { userId: user.id },
        include: {
          drop: { select: { name: true } },
          token: { select: { symbol: true, iconUrl: true } },
        },
        orderBy: { claimedAt: 'desc' },
        take: limit,
      });

      claims.forEach((c) => {
        transactions.push({
          id: c.id,
          type: 'claim',
          amount: c.amount.toString(),
          tokenSymbol: c.token?.symbol || '?',
          tokenIconUrl: c.token?.iconUrl,
          dropName: c.drop.name,
          status: c.status,
          txHash: c.txHash,
          createdAt: c.claimedAt,
        });
      });
    }

    // Get tokens created
    if (!type || type === 'all' || type === 'tokens') {
      const tokensCreated = await prisma.token.findMany({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      tokensCreated.forEach((t) => {
        transactions.push({
          id: t.id,
          type: 'token_created',
          tokenName: t.name,
          tokenSymbol: t.symbol,
          tokenIconUrl: t.iconUrl,
          maxSupply: t.maxSupply.toString(),
          contractAddress: t.contractAddress,
          createdAt: t.createdAt,
        });
      });
    }

    // Sort by date and paginate
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = transactions.slice(offset, offset + limit);

    return NextResponse.json({
      transactions: paginated,
      hasMore: transactions.length > offset + limit,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('GET /api/wallet/transactions', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}