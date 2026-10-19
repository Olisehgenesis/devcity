import { NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, getAddress, type Address } from 'viem';
import { celo } from 'viem/chains';
import { CELO_SEPOLIA, CHAIN } from '@/lib/chain';
import { originalAvatarSvg } from '@/lib/original-avatar';
import { prisma } from '@/lib/prisma';

const CELO_SEPOLIA_ID = CELO_SEPOLIA.chainId;

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const ERC20_META_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

function clientFor(chainId: number) {
  return createPublicClient({
    chain: chainId === celo.id ? celo : CHAIN,
    transport: http(chainId === celo.id ? celo.rpcUrls.default.http[0] : CELO_SEPOLIA.rpcUrl),
  });
}

function uploadedImage(data: string): { body: Uint8Array; type: string } | null {
  const base64 = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (base64) {
    return { body: Buffer.from(base64[2], 'base64'), type: base64[1] };
  }
  const svg = data.match(/^data:image\/svg\+xml(?:;charset=utf-8)?,(.+)$/);
  if (!svg) return null;
  return { body: Buffer.from(decodeURIComponent(svg[1]), 'utf8'), type: 'image/svg+xml' };
}

async function profileSeed(owner: Address, tokenName: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: owner, mode: 'insensitive' } },
      include: { avatarSettings: true, profile: true },
    });
    const settings = user?.avatarSettings;
    if (settings?.mode === 'UPLOAD' && settings.imageData) {
      const image = uploadedImage(settings.imageData);
      if (image) return image;
    }
    const seed = (settings?.mode !== 'UPLOAD' ? settings?.seed : null)
      || user?.profile?.displayName
      || user?.name
      || user?.username
      || tokenName
      || owner;
    return { body: Buffer.from(originalAvatarSvg(seed), 'utf8'), type: 'image/svg+xml' };
  } catch {
    return { body: Buffer.from(originalAvatarSvg(tokenName || owner), 'utf8'), type: 'image/svg+xml' };
  }
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

  let token: Address | null = null;
  let owner: Address | null = ownerParam && isAddress(ownerParam) ? getAddress(ownerParam) : null;
  if (addressParam && isAddress(addressParam)) {
    token = getAddress(addressParam);
  } else if (owner) {
    const resolved = await client.readContract({
      address: CELO_SEPOLIA.profileTokenFactory as Address,
      abi: PROFILE_FACTORY_ABI,
      functionName: 'getUserToken',
      args: [owner],
    });
    if (resolved.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
      token = getAddress(resolved);
    }
  }

  if (!token && !owner) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    let tokenName = '';
    if (token) {
      try {
        tokenName = (await client.readContract({
          address: token,
          abi: ERC20_META_ABI,
          functionName: 'name',
        })) as string;
      } catch {
        tokenName = '';
      }
    }
    const image = await profileSeed(owner ?? token!, tokenName);
    return new NextResponse(Buffer.from(image.body), {
      status: 200,
      headers: {
        'Content-Type': image.type,
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('GET /api/token-icon', error);
    return new NextResponse('Could not render token icon.', { status: 502 });
  }
}
