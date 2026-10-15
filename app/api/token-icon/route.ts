import { NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, getAddress, type Address } from 'viem';
import { celo } from 'viem/chains';
import { CELO_SEPOLIA, CHAIN } from '@/lib/chain';

const CELO_SEPOLIA_ID = CELO_SEPOLIA.chainId;

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const ERC20_META_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

function clientFor(chainId: number) {
  return createPublicClient({
    chain: chainId === celo.id ? celo : CHAIN,
    transport: http(chainId === celo.id ? celo.rpcUrls.default.http[0] : CELO_SEPOLIA.rpcUrl),
  });
}

/** Deterministic profile icon SVG for a token. */
function tokenIconSvg(symbol: string, address: string): string {
  const colors = ['#111', '#E6FF3A', '#00E5FF', '#FF5CA8', '#9B5CFF', '#FFB020'];
  const hash = address.slice(2, 8);
  let sum = 0;
  for (const ch of hash) sum += parseInt(ch, 16);
  const bg = colors[sum % colors.length];
  const letter = (symbol.replace(/[^A-Za-z0-9]/g, '') || 'T').slice(0, 1).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="${bg}"/><text x="60" y="78" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="52" font-weight="800" text-anchor="middle" fill="#0B0B0B">${letter}</text></svg>`;
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const chainId = Number(search.get('chainId') ?? String(CELO_SEPOLIA_ID));
  if (chainId !== celo.id && chainId !== CELO_SEPOLIA_ID) {
    return new NextResponse('Unsupported chain', { status: 400 });
  }
  const client = clientFor(chainId);
  const addressParam = search.get('address');
  const ownerParam = search.get('owner');

  let address: Address | null = null;
  if (addressParam && isAddress(addressParam)) {
    address = getAddress(addressParam);
  } else if (ownerParam && isAddress(ownerParam)) {
    const resolved = await client.readContract({
      address: CELO_SEPOLIA.profileTokenFactory as Address,
      abi: PROFILE_FACTORY_ABI,
      functionName: 'getUserToken',
      args: [getAddress(ownerParam) as Address],
    });
    if (resolved.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
      address = getAddress(resolved);
    }
  }

  if (!address) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    let symbol = '';
    try {
      symbol = (await client.readContract({
        address,
        abi: ERC20_META_ABI,
        functionName: 'symbol',
      })) as string;
    } catch {
      // Fall back to a letter derived from the address when symbol read fails.
    }
    const svg = tokenIconSvg(symbol, address);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('GET /api/token-icon', error);
    return new NextResponse('Could not render token icon.', { status: 502 });
  }
}
