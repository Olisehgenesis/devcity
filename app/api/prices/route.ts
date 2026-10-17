import { NextResponse } from 'next/server';

export const revalidate = 120;

const COINGECKO_IDS: Record<string, string> = {
  celo: 'CELO',
  tether: 'USDT',
  'usd-coin': 'USDC',
  'celo-dollar': 'cUSD',
};

const CELO_MAINNET = '0x471EcE3750Da237f93B8E339c536989b8978a438';

async function coinGecko(): Promise<Record<string, number>> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=celo,tether,usd-coin,celo-dollar&vs_currencies=usd',
    {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json', 'User-Agent': 'devcity26' },
    },
  );
  if (!response.ok) return {};
  const data = await response.json() as Record<string, { usd?: number }>;
  const usd: Record<string, number> = {};
  for (const [id, symbol] of Object.entries(COINGECKO_IDS)) {
    const price = Number(data[id]?.usd);
    if (Number.isFinite(price) && price > 0) usd[symbol] = price;
  }
  return usd;
}

async function celoFromDex(): Promise<number | null> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CELO_MAINNET}`, {
    next: { revalidate: 120 },
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json() as {
    pairs?: Array<{ chainId?: string; priceUsd?: string; liquidity?: { usd?: number } }>;
  };
  const pair = data.pairs
    ?.filter((item) => item.chainId === 'celo' && Number(item.priceUsd) > 0)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const price = Number(pair?.priceUsd);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function GET() {
  let usd: Record<string, number> = {};
  let source = 'CoinGecko';
  try {
    usd = await coinGecko();
  } catch {
    usd = {};
  }
  if (usd.CELO == null) {
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/CELO-USD/spot', {
        next: { revalidate: 120 },
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json() as { data?: { amount?: string } };
        const price = Number(data.data?.amount);
        if (Number.isFinite(price) && price > 0) {
          usd.CELO = price;
          source = 'Coinbase';
        }
      }
    } catch {
      // Try the Celo market quote next.
    }
  }
  if (usd.CELO == null) {
    try {
      const celo = await celoFromDex();
      if (celo != null) {
        usd.CELO = celo;
        source = 'DexScreener';
      }
    } catch {
      // Price stays unset. The wallet shows the token amount.
    }
  }
  if (usd.USDT == null) usd.USDT = 1;
  if (usd.USDC == null) usd.USDC = 1;
  if (usd.cUSD == null) usd.cUSD = 1;

  return NextResponse.json({
    usd,
    source,
    fetchedAt: new Date().toISOString(),
  });
}
