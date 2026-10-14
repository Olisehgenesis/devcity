import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

export const revalidate = 60;

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const address = search.get('address');
  const chainId = search.get('chainId') ?? '11142220';
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Provide a valid token contract address.' }, { status: 400 });
  }
  if (chainId !== '42220' && chainId !== '11142220') {
    return NextResponse.json({ error: 'Token pricing is only supported for Celo networks.' }, { status: 400 });
  }
  if (chainId === '11142220') {
    return NextResponse.json({
      priceUsd: null,
      source: 'Celo Sepolia markets are not indexed',
      fetchedAt: new Date().toISOString(),
    });
  }

  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    return NextResponse.json({ error: 'Token market data is temporarily unavailable.' }, { status: 502 });
  }

  const data = await response.json() as {
    pairs?: Array<{
      chainId?: string;
      pairAddress?: string;
      priceUsd?: string;
      priceNative?: string;
      baseToken?: { address?: string };
      quoteToken?: { address?: string };
      liquidity?: { usd?: number };
      volume?: { h24?: number };
    }>;
  };
  const pair = data.pairs
    ?.filter((item) => (
      item.chainId === 'celo'
      && Number.isFinite(Number(item.priceUsd))
      && Number(item.priceUsd) > 0
      && (
        item.baseToken?.address?.toLowerCase() === address.toLowerCase()
        || (item.quoteToken?.address?.toLowerCase() === address.toLowerCase() && Number.isFinite(Number(item.priceNative)) && Number(item.priceNative) > 0)
      )
    ))
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

  if (!pair) {
    return NextResponse.json({ priceUsd: null, source: 'No indexed Celo market', fetchedAt: new Date().toISOString() });
  }

  return NextResponse.json({
    priceUsd: pair.baseToken?.address?.toLowerCase() === address.toLowerCase()
      ? Number(pair.priceUsd)
      : Number(pair.priceUsd) / Number(pair.priceNative),
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24hUsd: pair.volume?.h24 ?? null,
    pairAddress: pair.pairAddress ?? null,
    source: 'DexScreener · Celo',
    fetchedAt: new Date().toISOString(),
  });
}
