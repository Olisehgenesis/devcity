import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, ApiError } from '@/lib/db-helpers';

const KNOWN_ICONS = new Set(['CELO', 'USDT', 'USDC', 'USDM', 'CUSD']);

function amountText(value: { toString(): string }) {
  const raw = value.toString();
  if (!raw.includes('.')) return raw;
  return raw.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function tokenIcon(token: {
  iconUrl: string | null;
  symbol: string;
  contractAddress: string | null;
  chainId: number;
  creator?: { walletAddress: string | null } | null;
} | null | undefined) {
  if (!token) return null;
  if (token.iconUrl) return token.iconUrl;
  if (KNOWN_ICONS.has(token.symbol.toUpperCase())) return null;
  const owner = token.creator?.walletAddress;
  if (owner) return `/api/token-icon?owner=${owner}&chainId=${token.chainId}`;
  if (token.contractAddress) return `/api/token-icon?address=${token.contractAddress}&chainId=${token.chainId}`;
  return null;
}

const tokenSelect = {
  name: true,
  symbol: true,
  description: true,
  iconUrl: true,
  chainId: true,
  contractAddress: true,
  decimals: true,
  creator: { select: { walletAddress: true } },
} as const;

// GET /api/wallet/transactions - Get user's transaction history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');

    if (!userAddress) {
      throw new ApiError(400, 'userAddress is required');
    }

    const user = await getOrCreateUser(userAddress);
    const transactions: Array<Record<string, unknown>> = [];

    if (!type || type === 'all' || type === 'tips') {
      const tipsSent = await prisma.tip.findMany({
        where: { fromUserId: user.id },
        include: {
          toUser: { select: { username: true, name: true, avatarUrl: true, walletAddress: true } },
          token: { select: tokenSelect },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      tipsSent.forEach((tip) => {
        transactions.push({
          id: tip.id,
          type: 'tip_sent',
          amount: amountText(tip.amount),
          tokenName: tip.token.name,
          tokenSymbol: tip.token.symbol,
          tokenDescription: tip.token.description,
          tokenIconUrl: tokenIcon(tip.token),
          contractAddress: tip.token.contractAddress,
          counterparty: tip.toUser.username || tip.toUser.name,
          counterpartyAddress: tip.toUser.walletAddress,
          counterpartyAvatar: tip.toUser.avatarUrl,
          txHash: tip.txHash,
          message: tip.message,
          createdAt: tip.createdAt,
        });
      });
    }

    if (!type || type === 'all' || type === 'tips') {
      const tipsReceived = await prisma.tip.findMany({
        where: { toUserId: user.id },
        include: {
          fromUser: { select: { username: true, name: true, avatarUrl: true, walletAddress: true } },
          token: { select: tokenSelect },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      tipsReceived.forEach((tip) => {
        transactions.push({
          id: tip.id,
          type: 'tip_received',
          amount: amountText(tip.amount),
          tokenName: tip.token.name,
          tokenSymbol: tip.token.symbol,
          tokenDescription: tip.token.description,
          tokenIconUrl: tokenIcon(tip.token),
          contractAddress: tip.token.contractAddress,
          counterparty: tip.fromUser.username || tip.fromUser.name,
          counterpartyAddress: tip.fromUser.walletAddress,
          counterpartyAvatar: tip.fromUser.avatarUrl,
          txHash: tip.txHash,
          message: tip.message,
          createdAt: tip.createdAt,
        });
      });
    }

    if (!type || type === 'all' || type === 'claims') {
      const claims = await prisma.dropClaim.findMany({
        where: { userId: user.id },
        include: {
          drop: { select: { name: true } },
          token: { select: tokenSelect },
        },
        orderBy: { claimedAt: 'desc' },
        take: limit,
      });
      claims.forEach((claim) => {
        transactions.push({
          id: claim.id,
          type: 'claim',
          amount: amountText(claim.amount),
          tokenName: claim.token?.name,
          tokenSymbol: claim.token?.symbol,
          tokenDescription: claim.token?.description,
          tokenIconUrl: tokenIcon(claim.token),
          contractAddress: claim.token?.contractAddress,
          dropName: claim.drop.name,
          status: claim.status,
          txHash: claim.txHash,
          createdAt: claim.claimedAt,
        });
      });
    }

    if (!type || type === 'all' || type === 'tokens') {
      const tokensCreated = await prisma.token.findMany({
        where: { creatorId: user.id },
        include: { creator: { select: { walletAddress: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      tokensCreated.forEach((token) => {
        transactions.push({
          id: token.id,
          type: 'token_created',
          amount: amountText(token.maxSupply),
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenDescription: token.description,
          tokenIconUrl: tokenIcon(token),
          maxSupply: amountText(token.maxSupply),
          contractAddress: token.contractAddress,
          createdAt: token.createdAt,
        });
      });
    }

    transactions.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
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
