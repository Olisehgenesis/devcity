import { NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, getAddress, type Address } from 'viem';
import { celo } from 'viem/chains';
import { CELO_SEPOLIA, CHAIN } from '@/lib/chain';

export const revalidate = 30;

const CELO_SEPOLIA_ID = CELO_SEPOLIA.chainId;

const ERC20_STATS_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

function clientFor(chainId: number) {
  return createPublicClient({
    chain: chainId === celo.id ? celo : CHAIN,
    transport: http(chainId === celo.id ? celo.rpcUrls.default.http[0] : CELO_SEPOLIA.rpcUrl),
  });
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const addressParam = search.get('address');
  const chainId = Number(search.get('chainId') ?? String(CELO_SEPOLIA_ID));
  const holderParam = search.get('holder') ?? null;

  if (!addressParam || !isAddress(addressParam)) {
    return NextResponse.json({ error: 'Provide a valid token contract address.' }, { status: 400 });
  }
  if (chainId !== celo.id && chainId !== CELO_SEPOLIA_ID) {
    return NextResponse.json({ error: 'Token stats are only supported for Celo networks.' }, { status: 400 });
  }

  const address = getAddress(addressParam);
  const client = clientFor(chainId);
  const holder = holderParam && isAddress(holderParam) ? getAddress(holderParam) : null;

  try {
    const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
      client.readContract({ address: address as Address, abi: ERC20_STATS_ABI, functionName: 'name' }),
      client.readContract({ address: address as Address, abi: ERC20_STATS_ABI, functionName: 'symbol' }),
      client.readContract({ address: address as Address, abi: ERC20_STATS_ABI, functionName: 'decimals' }),
      client.readContract({ address: address as Address, abi: ERC20_STATS_ABI, functionName: 'totalSupply' }),
      holder
        ? client.readContract({ address: address as Address, abi: ERC20_STATS_ABI, functionName: 'balanceOf', args: [holder as Address] })
        : Promise.resolve(null),
    ]);

    const dec = Number(decimals);
    const rawSupply = totalSupply as bigint;
    const formattedSupply = Number(rawSupply) / 10 ** dec;

    return NextResponse.json({
      address,
      chainId,
      name,
      symbol,
      decimals: dec,
      totalSupply: rawSupply.toString(),
      totalSupplyFormatted: formattedSupply,
      icon: `/api/token-icon?address=${address}&chainId=${chainId}`,
      holderBalance: holder && balance != null ? (balance as bigint).toString() : null,
      holderBalanceFormatted: holder && balance != null ? Number(balance as bigint) / 10 ** dec : null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/token-stats', error);
    return NextResponse.json({ error: 'Could not read token stats.' }, { status: 502 });
  }
}
