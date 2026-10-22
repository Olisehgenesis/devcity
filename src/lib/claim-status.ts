import { createPublicClient, http, type Address } from 'viem';
import { celoSepolia } from 'viem/chains';
import { CELO_SEPOLIA } from './chain';
import { prisma } from './prisma';
import { dropIdToBytes32 } from './signer';

const DROP_CLAIM_ABI = [
  {
    type: 'function',
    name: 'getDrop',
    stateMutability: 'view',
    inputs: [{ name: 'dropId', type: 'bytes32' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'amountPerClaim', type: 'uint256' },
      { name: 'maxClaimants', type: 'uint256' },
      { name: 'currentClaimants', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'claimAuthority', type: 'address' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'hasUserClaimed',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'dropId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hasClaimed',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'dropId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type DropClaimStatus = {
  dropId: string;
  claimedByUser: boolean;
  currentClaimants: number;
  source: 'chain' | 'database';
};

function claimantsFromDrop(drop: { currentClaimants: bigint } | readonly unknown[]): number {
  const value = 'currentClaimants' in drop ? drop.currentClaimants : drop[4];
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chainField(drop: unknown, index: number, name: string): unknown {
  if (drop && typeof drop === 'object' && name in drop) return (drop as Record<string, unknown>)[name];
  return Array.isArray(drop) ? drop[index] : undefined;
}

/** An unregistered drop reads back as a zero token. That is not a real claim count. */
export function isRegisteredChainDrop(drop: unknown): boolean {
  const token = chainField(drop, 0, 'token');
  const active = chainField(drop, 8, 'isActive');
  const zero = typeof token === 'string' && /^0x0{40}$/i.test(token);
  return !(zero && active !== true);
}

async function readChainDrop(dropId: string, userAddress?: Address): Promise<Pick<DropClaimStatus, 'claimedByUser' | 'currentClaimants'>> {
  const client = createPublicClient({
    chain: celoSepolia,
    transport: http(CELO_SEPOLIA.rpcUrl, { timeout: 8_000 }),
  });
  const dropIdBytes = dropIdToBytes32(dropId);
  const drop = await client.readContract({
    address: CELO_SEPOLIA.dropClaim,
    abi: DROP_CLAIM_ABI,
    functionName: 'getDrop',
    args: [dropIdBytes],
  });
  if (!isRegisteredChainDrop(drop)) {
    throw new Error('Drop is not registered on chain');
  }
  let claimedByUser = false;
  if (userAddress) {
    try {
      claimedByUser = await client.readContract({
        address: CELO_SEPOLIA.dropClaim,
        abi: DROP_CLAIM_ABI,
        functionName: 'hasUserClaimed',
        args: [userAddress, dropIdBytes],
      });
    } catch {
      claimedByUser = await client.readContract({
        address: CELO_SEPOLIA.dropClaim,
        abi: DROP_CLAIM_ABI,
        functionName: 'hasClaimed',
        args: [userAddress, dropIdBytes],
      });
    }
  }
  return { claimedByUser, currentClaimants: claimantsFromDrop(drop) };
}

export async function claimStatusForDrops(userAddress?: string | null): Promise<DropClaimStatus[]> {
  const drops = await prisma.drop.findMany({
    where: { status: { in: ['ACTIVE', 'SCHEDULED'] } },
    select: { id: true, currentClaimants: true },
  });
  const normalized = userAddress?.trim().toLowerCase() ?? '';
  const validUser = /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : '';
  const user = validUser
    ? await prisma.user.findFirst({
      where: { walletAddress: { equals: validUser, mode: 'insensitive' } },
      select: { id: true },
    })
    : null;
  const confirmed = new Set<string>();
  if (user) {
    const rows = await prisma.dropClaim.findMany({
      where: { userId: user.id, status: 'CONFIRMED', dropId: { in: drops.map((drop) => drop.id) } },
      select: { dropId: true },
    });
    for (const row of rows) confirmed.add(row.dropId);
  }

  return Promise.all(drops.map(async (drop) => {
    try {
      const chain = await readChainDrop(drop.id, validUser ? validUser as Address : undefined);
      if (chain.currentClaimants !== drop.currentClaimants) {
        await prisma.drop.update({
          where: { id: drop.id },
          data: { currentClaimants: chain.currentClaimants },
        });
      }
      return { dropId: drop.id, ...chain, source: 'chain' as const };
    } catch {
      return {
        dropId: drop.id,
        claimedByUser: confirmed.has(drop.id),
        currentClaimants: drop.currentClaimants,
        source: 'database' as const,
      };
    }
  }));
}
