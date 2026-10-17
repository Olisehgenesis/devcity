import { prisma } from './prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { signClaimAuthorization, dropIdToBytes32, CLAIM_CHAIN } from './signer';
import { getNonce } from '../../contracts/interact';
import { parseUnits, type Hex } from 'viem';
import { rateLimit, RATE_LIMITS, getClientIdentifier } from './rate-limit';
import { NextRequest } from 'next/server';
import { CLAIM_RADIUS_M, distanceMeters, formatDistance } from './geo';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function toDecimal(value: Decimal | number | string): Decimal {
  return new Decimal(value.toString());
}

function toNumber(value: Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function toIso(value: Date | null | undefined): string | null {
  if (value == null) return null;
  return value.toISOString();
}

function roundCoordinates(lat: number | null, lng: number | null, visibility: string): { lat: number | null; lng: number | null } {
  if (lat == null || lng == null) return { lat, lng };
  
  if (visibility === 'VISIBLE') {
    return { lat, lng };
  }
  
  const precision = 1000;
  return {
    lat: Math.round(lat * precision) / precision,
    lng: Math.round(lng * precision) / precision,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getOrCreateUser(userAddress: string) {
  const address = normalizeAddress(userAddress);
  if (!address) throw new ApiError(400, 'userAddress is required');
  const id = `user_${address}`;
  const username = `user_${address.slice(2, 8)}`;
  return prisma.user.upsert({
    where: { walletAddress: address },
    create: {
      id,
      walletAddress: address,
      username,
      email: `${address}@devcity.local`,
    },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

export function serializeDrop(drop: any) {
  return {
    id: drop.id,
    name: drop.name,
    description: drop.description ?? null,
    tokenAddress: drop.token?.contractAddress ?? null,
    tokenSymbol: drop.token?.symbol ?? null,
    tokenIconUrl: drop.token?.iconUrl ?? null,
    tokenDecimals: drop.token?.decimals ?? 18,
    amount: drop.amount.toString(),
    maxClaimants: drop.maxClaimants,
    currentClaimants: drop.currentClaimants,
    startsAt: toIso(drop.startsAt),
    endsAt: toIso(drop.expiresAt),
    lat: toNumber(drop.latitude),
    lng: toNumber(drop.longitude),
    radius: drop.radius,
    status: drop.status,
    creatorAddress: drop.creator?.walletAddress ?? null,
    createdAt: toIso(drop.createdAt),
  };
}

export async function listActiveDrops() {
  const now = new Date();
  const drops = await prisma.drop.findMany({
    where: {
      status: { in: ['ACTIVE', 'SCHEDULED'] },
      startsAt: { lte: now },
      expiresAt: { gte: now },
    },
    include: { token: true, creator: true },
    orderBy: { createdAt: 'desc' },
  });
  return drops.map(serializeDrop);
}

export async function createDrop(input: {
  id?: string;
  name: string;
  description?: string;
  tokenAddress: string;
  /** Real ERC-20 metadata for an existing token; falls back to the drop name otherwise. */
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  amount: string | number;
  maxClaimants: number;
  startsAt: string;
  endsAt: string;
  lat?: number;
  lng?: number;
  creatorAddress: string;
}) {
  const creator = await getOrCreateUser(input.creatorAddress);
  const chainId = CLAIM_CHAIN.id;
  const contractAddress = input.tokenAddress.trim().toLowerCase();
  const amountDecimal = toDecimal(input.amount);
  if (amountDecimal.lte(0)) throw new ApiError(400, 'Drop amount must be greater than zero.');
  if (!Number.isInteger(input.maxClaimants) || input.maxClaimants < 1) {
    throw new ApiError(400, 'Max claimants must be a positive whole number.');
  }

  const token = await prisma.token.upsert({
    where: { chainId_contractAddress: { chainId, contractAddress } },
    create: {
      creatorId: creator.id,
      name: input.tokenName?.trim() || input.name,
      symbol: input.tokenSymbol?.trim().toUpperCase() || input.name.slice(0, 4).toUpperCase(),
      chainId,
      contractAddress,
      decimals: input.tokenDecimals ?? 18,
      maxSupply: amountDecimal.mul(input.maxClaimants),
    },
    update: {
      ...(input.tokenSymbol?.trim() ? { symbol: input.tokenSymbol.trim().toUpperCase() } : {}),
      ...(input.tokenName?.trim() ? { name: input.tokenName.trim() } : {}),
      ...(input.tokenDecimals != null ? { decimals: input.tokenDecimals } : {}),
    },
  });

  const drop = await prisma.drop.create({
    data: {
      id: input.id,
      creatorId: creator.id,
      tokenId: token.id,
      name: input.name,
      description: input.description ?? null,
      amount: amountDecimal,
      maxClaimants: input.maxClaimants,
      startsAt: new Date(input.startsAt),
      expiresAt: new Date(input.endsAt),
      status: 'ACTIVE',
      latitude: input.lat != null ? toDecimal(input.lat) : null,
      longitude: input.lng != null ? toDecimal(input.lng) : null,
    },
    include: { token: true, creator: true },
  });

  return serializeDrop(drop);
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export async function authorizeClaim(
  dropId: string,
  userAddress: string,
  request?: NextRequest,
  coords?: { lat?: unknown; lng?: unknown },
) {
  if (request) {
    const clientId = getClientIdentifier(request);
    const rlResult = rateLimit(`claim:${clientId}:${dropId}`, RATE_LIMITS.claimAuthorize);
    if (!rlResult.allowed) {
      throw new ApiError(429, 'Rate limit exceeded. Please wait before requesting another claim authorization.');
    }
  }

  const user = await getOrCreateUser(userAddress);
  const drop = await prisma.drop.findUnique({
    where: { id: dropId },
    include: { token: true },
  });
  if (!drop) throw new ApiError(404, 'Drop not found');

  const now = new Date();
  if (drop.status !== 'ACTIVE' && drop.status !== 'SCHEDULED') {
    throw new ApiError(400, 'Drop is not active');
  }
  if (now < drop.startsAt) throw new ApiError(400, 'Drop has not started yet');
  if (now > drop.expiresAt) throw new ApiError(400, 'Drop has expired');

  const dropLat = toNumber(drop.latitude);
  const dropLng = toNumber(drop.longitude);
  if (dropLat != null && dropLng != null) {
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError(400, 'Turn on location. You need to be within 100 m of this drop to claim.');
    }
    const meters = distanceMeters(lat, lng, dropLat, dropLng);
    if (meters > CLAIM_RADIUS_M) {
      throw new ApiError(400, `You are ${formatDistance(meters)} away. Get within 100 m of this drop to claim.`);
    }
  }

  const existing = await prisma.dropClaim.findUnique({
    where: { dropId_userId: { dropId, userId: user.id } },
  });
  if (existing?.status === 'CONFIRMED') throw new ApiError(409, 'Already claimed this drop');

  const claimAmount = toDecimal(drop.amount);
  const tokenDecimals = drop.token.decimals ?? 18;
  const maxSupply = toDecimal(drop.token.maxSupply || 0);
  if (maxSupply.gt(0) && claimAmount.gt(maxSupply)) {
    throw new ApiError(400, 'Claim amount exceeds token supply');
  }

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 60 * 15);

  let nonce = BigInt(0);
  if (process.env.NEXT_PUBLIC_DROPCLAIM_ADDRESS) {
    try {
      nonce = await getNonce(user.walletAddress as Hex);
    } catch (e) {
      throw new ApiError(503, 'Unable to read chain nonce. Please try again.');
    }
  }

  const amountWei = parseUnits(claimAmount.toFixed(tokenDecimals), tokenDecimals);

  const signature = await signClaimAuthorization({
    dropId: dropIdToBytes32(dropId),
    claimant: user.walletAddress as Hex,
    amount: amountWei,
    nonce,
    deadline: expiresAt,
  });

  if (!existing) {
    await prisma.$transaction(async (tx) => {
      await tx.dropClaim.create({
        data: {
          dropId,
          userId: user.id,
          tokenId: drop.tokenId,
          amount: drop.amount,
          status: 'PENDING',
        },
      });

      await tx.drop.update({
        where: { id: dropId },
        data: {
          currentClaimants: { increment: 1 },
        },
      });
    });
  }

  // Real drop claim → award the first-claim badge + a city sticker.
  await applyGameActions(userAddress, {
    awardBadge: 'first-claim',
    collectSticker: 'city',
  });

  return {
    signature,
    dropId,
    dropIdBytes32: dropIdToBytes32(dropId),
    claimer: user.walletAddress,
    nonce: nonce.toString(),
    amount: amountWei.toString(),
    expiresAt: expiresAt.toString(),
  };
}

export async function listClaims(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const claims = await prisma.dropClaim.findMany({
    where: { userId: user.id },
    include: {
      drop: { include: { token: true } },
    },
    orderBy: { claimedAt: 'desc' },
  });
  return claims.map((claim) => ({
    id: claim.id,
    dropId: claim.dropId,
    dropName: claim.drop.name,
    tokenSymbol: claim.drop.token.symbol,
    tokenIconUrl: claim.drop.token.iconUrl,
    amount: claim.amount.toString(),
    status: claim.status,
    txHash: claim.txHash ?? null,
    claimedAt: toIso(claim.claimedAt),
  }));
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export function serializePresence(presence: any) {
  return {
    id: presence.id,
    userId: presence.userId,
    status: presence.status,
    lat: toNumber(presence.latitude),
    lng: toNumber(presence.longitude),
    visibility: presence.visibility,
    lastUpdated: toIso(presence.lastUpdated),
    expiresAt: toIso(presence.expiresAt),
  };
}

export async function updatePresence(input: {
  userAddress: string;
  status?: string;
  lat?: number;
  lng?: number;
  visibility?: string;
  request?: NextRequest;
}) {
  if (input.request) {
    const clientId = getClientIdentifier(input.request);
    const rlResult = rateLimit(`presence:${clientId}`, RATE_LIMITS.updatePresence);
    if (!rlResult.allowed) {
      throw new ApiError(429, 'Rate limit exceeded for presence updates.');
    }
  }

  const user = await getOrCreateUser(input.userAddress);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  const presence = await prisma.presence.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      latitude: toDecimal(input.lat ?? 0),
      longitude: toDecimal(input.lng ?? 0),
      status: (input.status ?? 'ONLINE') as any,
      visibility: (input.visibility ?? 'APPROXIMATE') as any,
      expiresAt,
    },
    update: {
      latitude: input.lat != null ? toDecimal(input.lat) : undefined,
      longitude: input.lng != null ? toDecimal(input.lng) : undefined,
      status: input.status ? (input.status as any) : undefined,
      visibility: input.visibility ? (input.visibility as any) : undefined,
      expiresAt,
    },
  });

  return serializePresence(presence);
}

export async function nearbyPresence(lat: number, lng: number, radiusKm: number) {
  const radius = radiusKm > 0 ? radiusKm : 1;
  const presences = await prisma.presence.findMany({
    where: {
      visibility: { not: 'INVISIBLE' },
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  const users = presences
    .map((p) => {
      const distance = haversineKm(lat, lng, Number(p.latitude), Number(p.longitude));
      return { presence: p, distance };
    })
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map(({ presence, distance }) => {
      const coords = roundCoordinates(
        Number(presence.latitude),
        Number(presence.longitude),
        presence.visibility
      );
      return {
        userId: presence.userId,
        username: presence.user.username,
        avatarUrl: presence.user.avatarUrl,
        status: presence.status,
        visibility: presence.visibility,
        lat: coords.lat,
        lng: coords.lng,
        distance: Math.round(distance * 1000) / 1000,
        lastUpdated: toIso(presence.lastUpdated),
      };
    });

  return users;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export function serializeBroadcast(broadcast: any, viewerAddress?: string) {
  const viewer = viewerAddress ? normalizeAddress(viewerAddress) : null;
  return {
    id: broadcast.id,
    text: broadcast.text,
    mediaUrl: broadcast.mediaUrl ?? null,
    userId: broadcast.userId,
    username: broadcast.user?.username ?? null,
    avatarUrl: broadcast.user?.avatarUrl ?? null,
    createdAt: toIso(broadcast.createdAt),
    likes: broadcast._count?.broadcastLikes ?? broadcast.broadcastLikes?.length ?? 0,
    liked: viewer
      ? (broadcast.broadcastLikes?.some((l: any) => l.userId === `user_${viewer}`) ?? false)
      : false,
    comments: (broadcast.broadcastComments ?? []).map((c: any) => ({
      id: c.id,
      text: c.text,
      userId: c.userId,
      username: c.user?.username ?? null,
      avatarUrl: c.user?.avatarUrl ?? null,
      createdAt: toIso(c.createdAt),
    })),
    reactions: (broadcast.broadcastReactions ?? []).map((r: any) => ({
      id: r.id,
      emoji: r.emoji,
      userId: r.userId,
      username: r.user?.username ?? null,
      createdAt: toIso(r.createdAt),
    })),
  };
}

export async function listBroadcasts(viewerAddress?: string) {
  const broadcasts = await prisma.broadcast.findMany({
    include: {
      user: true,
      _count: { select: { broadcastLikes: true, broadcastComments: true } },
      broadcastLikes: viewerAddress ? { where: { userId: `user_${normalizeAddress(viewerAddress)}` } } : false,
      broadcastComments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      broadcastReactions: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return broadcasts.map((b) => serializeBroadcast(b, viewerAddress));
}

export async function createBroadcast(userAddress: string, text: string, mediaUrl?: string, request?: NextRequest) {
  if (request) {
    const clientId = getClientIdentifier(request);
    const rlResult = rateLimit(`broadcast:${clientId}`, RATE_LIMITS.createBroadcast);
    if (!rlResult.allowed) {
      throw new ApiError(429, 'Rate limit exceeded for broadcasts.');
    }
  }

  const user = await getOrCreateUser(userAddress);
  const trimmed = text.trim().slice(0, 240);
  if (!trimmed && !mediaUrl) throw new ApiError(400, 'text or media is required');

  const broadcast = await prisma.broadcast.create({
    data: { userId: user.id, text: trimmed, mediaUrl: mediaUrl || null },
    include: { user: true, broadcastLikes: true, broadcastComments: { include: { user: true } } },
  });

  await prisma.activity.create({
    data: {
      userId: user.id,
      kind: 'broadcast',
      text: `You shared: ${trimmed}`,
      refId: broadcast.id,
    },
  });

  return serializeBroadcast(broadcast, userAddress);
}

export async function toggleLike(broadcastId: string, userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new ApiError(404, 'Broadcast not found');

  const existing = await prisma.broadcastLike.findUnique({
    where: { broadcastId_userId: { broadcastId, userId: user.id } },
  });

  if (existing) {
    await prisma.broadcastLike.delete({
      where: { broadcastId_userId: { broadcastId, userId: user.id } },
    });
  } else {
    await prisma.broadcastLike.create({
      data: { broadcastId, userId: user.id },
    });
  }

  const updated = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      user: true,
      _count: { select: { broadcastLikes: true, broadcastComments: true } },
      broadcastLikes: { where: { userId: user.id } },
      broadcastComments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  return serializeBroadcast(updated, userAddress);
}

export async function addComment(broadcastId: string, userAddress: string, text: string) {
  const user = await getOrCreateUser(userAddress);
  const trimmed = text.trim().slice(0, 240);
  if (!trimmed) throw new ApiError(400, 'text is required');

  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new ApiError(404, 'Broadcast not found');

  await prisma.broadcastComment.create({
    data: { broadcastId, userId: user.id, text: trimmed },
  });

  const updated = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      user: true,
      _count: { select: { broadcastLikes: true, broadcastComments: true } },
      broadcastLikes: { where: { userId: user.id } },
      broadcastComments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  return serializeBroadcast(updated, userAddress);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export function serializeStory(story: any) {
  return {
    id: story.id,
    content: story.content,
    mediaUrl: story.mediaUrl ?? null,
    userId: story.userId,
    username: story.user?.username ?? null,
    avatarUrl: story.user?.avatarUrl ?? null,
    createdAt: toIso(story.createdAt),
    expiresAt: toIso(story.expiresAt),
  };
}

export async function listStories() {
  const stories = await prisma.story.findMany({
    where: { expiresAt: { gte: new Date() } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return stories.map(serializeStory);
}

export async function createStory(userAddress: string, content: string, mediaUrl?: string, request?: NextRequest) {
  if (request) {
    const clientId = getClientIdentifier(request);
    const rlResult = rateLimit(`story:${clientId}`, RATE_LIMITS.createStory);
    if (!rlResult.allowed) {
      throw new ApiError(429, 'Rate limit exceeded for stories.');
    }
  }

  const user = await getOrCreateUser(userAddress);
  const trimmed = content.trim().slice(0, 1000);
  if (!trimmed && !mediaUrl) throw new ApiError(400, 'content or media is required');

  const story = await prisma.story.create({
    data: {
      userId: user.id,
      content: trimmed,
      mediaUrl: mediaUrl || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    include: { user: true },
  });

  await prisma.activity.create({
    data: {
      userId: user.id,
      kind: 'story',
      text: 'You posted a story',
      refId: story.id,
    },
  });

  return serializeStory(story);
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function listActivity(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const activity = await prisma.activity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return activity.map((a) => ({
    id: a.id,
    kind: a.kind,
    text: a.text,
    refId: a.refId ?? null,
    createdAt: toIso(a.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Avatar settings
// ---------------------------------------------------------------------------

export async function getAvatarSettings(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const settings = await prisma.avatarSettings.findUnique({
    where: { userId: user.id },
  });
  return {
    mode: settings?.mode ?? 'DICEBEAR',
    seed: settings?.seed ?? null,
    imageData: settings?.imageData ?? null,
  };
}

export async function setAvatarSettings(input: {
  userAddress: string;
  mode?: string;
  seed?: string;
  imageData?: string;
}) {
  const user = await getOrCreateUser(input.userAddress);
  const settings = await prisma.avatarSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: (input.mode ?? 'DICEBEAR') as any,
      seed: input.seed ?? null,
      imageData: input.imageData ?? null,
    },
    update: {
      mode: input.mode ? (input.mode as any) : undefined,
      seed: input.seed !== undefined ? input.seed : undefined,
      imageData: input.imageData !== undefined ? input.imageData : undefined,
    },
  });
  return {
    mode: settings.mode,
    seed: settings.seed,
    imageData: settings.imageData,
  };
}

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

export async function getMe(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const [avatar, presence] = await Promise.all([
    prisma.avatarSettings.findUnique({ where: { userId: user.id } }),
    prisma.presence.findUnique({ where: { userId: user.id } }),
  ]);
  return {
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: toIso(user.createdAt),
    },
    avatar: {
      mode: avatar?.mode ?? 'DICEBEAR',
      seed: avatar?.seed ?? null,
      imageData: avatar?.imageData ?? null,
    },
    visibility: presence?.visibility ?? 'APPROXIMATE',
    presence: presence ? serializePresence(presence) : null,
  };
}

export async function updateMe(input: {
  userAddress: string;
  avatarMode?: string;
  avatarSeed?: string;
  avatarImageData?: string;
  visibility?: string;
  presenceStatus?: string;
}) {
  const user = await getOrCreateUser(input.userAddress);

  if (input.avatarMode !== undefined || input.avatarSeed !== undefined || input.avatarImageData !== undefined) {
    await setAvatarSettings({
      userAddress: input.userAddress,
      mode: input.avatarMode,
      seed: input.avatarSeed,
      imageData: input.avatarImageData,
    });
  }

  if (input.visibility !== undefined || input.presenceStatus !== undefined) {
    const presence = await prisma.presence.findUnique({ where: { userId: user.id } });
    await prisma.presence.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        latitude: toDecimal(Number(presence?.latitude ?? 0)),
        longitude: toDecimal(Number(presence?.longitude ?? 0)),
        status: (input.presenceStatus ?? presence?.status ?? 'ONLINE') as any,
        visibility: (input.visibility ?? presence?.visibility ?? 'APPROXIMATE') as any,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      update: {
        status: input.presenceStatus ? (input.presenceStatus as any) : undefined,
        visibility: input.visibility ? (input.visibility as any) : undefined,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  }

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  return {
    user: {
      id: updated!.id,
      walletAddress: updated!.walletAddress,
      username: updated!.username,
      email: updated!.email,
      avatarUrl: updated!.avatarUrl,
      createdAt: toIso(updated!.createdAt),
    },
  };
}

// ---------------------------------------------------------------------------
// Stalls
// ---------------------------------------------------------------------------

export function serializeStall(stall: any) {
  return {
    id: stall.id,
    ownerId: stall.ownerId,
    name: stall.name,
    description: stall.description,
    latitude: Number(stall.latitude),
    longitude: Number(stall.longitude),
    radiusM: stall.radiusM,
    imageUrl: stall.imageUrl,
    tags: stall.tags ?? [],
    isActive: stall.isActive,
    createdAt: toIso(stall.createdAt),
    updatedAt: toIso(stall.updatedAt),
  };
}

export async function listStalls(opts?: { lat?: number; lng?: number; radiusKm?: number }) {
  const where: any = { isActive: true };
  if (opts?.lat != null && opts?.lng != null) {
    const km = opts.radiusKm ?? 5;
    const dLat = km / 111;
    const dLng = km / (111 * Math.cos((opts.lat * Math.PI) / 180));
    where.latitude = { gte: toDecimal(opts.lat - dLat), lte: toDecimal(opts.lat + dLat) };
    where.longitude = { gte: toDecimal(opts.lng - dLng), lte: toDecimal(opts.lng + dLng) };
  }
  const stalls = await prisma.stall.findMany({ where, orderBy: { createdAt: 'desc' } });
  return stalls.map(serializeStall);
}

export async function createStall(input: {
  ownerId: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radiusM?: number;
  imageUrl?: string;
  tags?: string[];
}) {
  if (!input.name) throw new ApiError(400, 'name is required');
  if (input.lat == null || input.lng == null) throw new ApiError(400, 'lat and lng are required');
  const stall = await prisma.stall.create({
    data: {
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      latitude: toDecimal(input.lat),
      longitude: toDecimal(input.lng),
      radiusM: input.radiusM ?? 50,
      imageUrl: input.imageUrl,
      tags: input.tags ?? [],
    },
  });
  await applyGameActions(input.ownerId, { awardBadge: 'event-host' });
  return serializeStall(stall);
}

// ---------------------------------------------------------------------------
// Booths
// ---------------------------------------------------------------------------

export function serializeBooth(booth: any) {
  return {
    id: booth.id,
    ownerId: booth.ownerId,
    stallId: booth.stallId,
    eventId: booth.eventId,
    name: booth.name,
    description: booth.description,
    latitude: Number(booth.latitude),
    longitude: Number(booth.longitude),
    radiusM: booth.radiusM,
    imageUrl: booth.imageUrl,
    isActive: booth.isActive,
    createdAt: toIso(booth.createdAt),
    updatedAt: toIso(booth.updatedAt),
  };
}

export async function listBooths(opts?: { lat?: number; lng?: number; radiusKm?: number; eventId?: string }) {
  const where: any = { isActive: true };
  if (opts?.eventId) where.eventId = opts.eventId;
  if (opts?.lat != null && opts?.lng != null) {
    const km = opts.radiusKm ?? 5;
    const dLat = km / 111;
    const dLng = km / (111 * Math.cos((opts.lat * Math.PI) / 180));
    where.latitude = { gte: toDecimal(opts.lat - dLat), lte: toDecimal(opts.lat + dLat) };
    where.longitude = { gte: toDecimal(opts.lng - dLng), lte: toDecimal(opts.lng + dLng) };
  }
  const booths = await prisma.booth.findMany({ where, orderBy: { createdAt: 'desc' } });
  return booths.map(serializeBooth);
}

export async function createBooth(input: {
  ownerId: string;
  stallId?: string;
  eventId?: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radiusM?: number;
  imageUrl?: string;
}) {
  if (!input.name) throw new ApiError(400, 'name is required');
  if (input.lat == null || input.lng == null) throw new ApiError(400, 'lat and lng are required');
  const booth = await prisma.booth.create({
    data: {
      ownerId: input.ownerId,
      stallId: input.stallId,
      eventId: input.eventId,
      name: input.name,
      description: input.description,
      latitude: toDecimal(input.lat),
      longitude: toDecimal(input.lng),
      radiusM: input.radiusM ?? 100,
      imageUrl: input.imageUrl,
    },
  });
  return serializeBooth(booth);
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

export async function followUser(followerAddress: string, followingAddress: string) {
  const follower = await getOrCreateUser(followerAddress);
  const following = await getOrCreateUser(followingAddress);
  if (follower.id === following.id) throw new ApiError(400, 'Cannot follow yourself');
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: follower.id, followingId: following.id } },
    create: { followerId: follower.id, followingId: following.id },
    update: {},
  });
  return { following: { id: following.id, followingAddress: following.walletAddress } };
}

export async function unfollowUser(followerAddress: string, followingAddress: string) {
  const follower = await getOrCreateUser(followerAddress);
  await prisma.follow.deleteMany({
    where: { followerId: follower.id, followingId: (await getOrCreateUser(followingAddress)).id },
  });
  return { ok: true };
}

export async function listFollowing(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const rows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: { following: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.following.id,
    walletAddress: r.following.walletAddress,
    username: r.following.username,
    name: r.following.name,
    avatarUrl: r.following.avatarUrl,
    followedAt: toIso(r.createdAt),
  }));
}

export async function listFollowers(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const rows = await prisma.follow.findMany({
    where: { followingId: user.id },
    include: { follower: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.follower.id,
    walletAddress: r.follower.walletAddress,
    username: r.follower.username,
    name: r.follower.name,
    avatarUrl: r.follower.avatarUrl,
    followedAt: toIso(r.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Tips (DB-backed; on-chain ERC-20 transfer is a separate chain step)
// ---------------------------------------------------------------------------

export async function createTip(input: {
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  amount: string;
  message?: string;
}) {
  if (!input.toAddress || !input.tokenSymbol || !input.amount) {
    throw new ApiError(400, 'fromAddress, toAddress, tokenSymbol and amount are required');
  }
  const from = await getOrCreateUser(input.fromAddress);
  const to = await getOrCreateUser(input.toAddress);
  const token = await prisma.token.findFirst({ where: { symbol: { equals: input.tokenSymbol, mode: 'insensitive' } } });
  if (!token) throw new ApiError(404, `No token "${input.tokenSymbol}" — pick a token in the app.`);
  if (from.id === to.id) throw new ApiError(400, 'Cannot tip yourself');
  const tip = await prisma.tip.create({
    data: {
      fromUserId: from.id,
      toUserId: to.id,
      tokenId: token.id,
      amount: toDecimal(input.amount),
      message: input.message,
    },
  });

  // Real tip → generous-tipper badge.
  await applyGameActions(input.fromAddress, { awardBadge: 'generous-tipper' });

  return {
    id: tip.id,
    toId: to.id,
    tokenSymbol: token.symbol,
    amount: tip.amount.toString(),
    createdAt: toIso(tip.createdAt),
  };
}

export async function listTips(userAddress: string, type: 'sent' | 'received' = 'sent') {
  const user = await getOrCreateUser(userAddress);
  const where = type === 'received' ? { toUserId: user.id } : { fromUserId: user.id };
  const rows = await prisma.tip.findMany({
    where,
    include: { token: true, fromUser: true, toUser: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount.toString(),
    tokenSymbol: r.token.symbol,
    message: r.message,
    direction: type,
    from: r.fromUser.walletAddress,
    to: r.toUser.walletAddress,
    txHash: r.txHash,
    createdAt: toIso(r.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Game layer (cosmetic, non-financial: streak, badges, stickers).
// Progression is derived from REAL on-chain activity (claims, tips, events,
// hosted spots, broadcasts), never from fake points.
// ---------------------------------------------------------------------------

// One level per tier of real actions (claims, tips, events, spots, posts).
const ACTIONS_PER_LEVEL = 5;

// Real-action counters for a user (from the DB, not synthetic).
export async function activityCounts(userId: string) {
  const [claims, tipsSent, events, spots, broadcasts] = await Promise.all([
    prisma.dropClaim.count({ where: { userId } }),
    prisma.tip.count({ where: { fromUserId: userId } }),
    prisma.eventRsvp.count({ where: { userId, status: { in: ['going', 'attended'] } } }),
    prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT (SELECT COUNT(*) FROM stalls WHERE "ownerId" = $1) +
              (SELECT COUNT(*) FROM booths WHERE "ownerId" = $1) AS c`,
      userId,
    ),
    prisma.broadcast.count({ where: { userId } }),
  ]);
  const spotsN = Number(spots?.[0]?.c ?? BigInt(0));
  const total = claims + tipsSent + events + spotsN + broadcasts;
  return { claims, tipsSent, events, spots: spotsN, broadcasts, total };
}

export function levelFromActions(total: number): number {
  return Math.floor(total / ACTIONS_PER_LEVEL) + 1;
}

export async function getGameProfile(userAddress: string) {
  const user = await getOrCreateUser(userAddress);
  const [game, counts] = await Promise.all([
    prisma.gameProfile.findUnique({ where: { userId: user.id } }),
    activityCounts(user.id),
  ]);
  return {
    level: levelFromActions(counts.total),
    counts,
    streak: game?.streak ?? 0,
    lastVisitDay: game?.lastVisitDay ?? null,
    badges: game?.badges ?? [],
    stickers: game?.stickers ?? {},
    leaderboardsOptIn: game?.leaderboardsOptIn ?? false,
  };
}

/**
 * Apply game mutations (daily touch, badge, sticker, leaderboard opt-in) and
 * always recompute the level from real activity. Returns the refreshed profile.
 * Badge awards themselves are triggered from the real flows that earn them
 * (claims, tips, RSVPs, hosted spots) — this just persists them.
 */
export async function applyGameActions(
  userAddress: string,
  input: {
    touch?: boolean;
    awardBadge?: string | null;
    collectSticker?: string | null;
    leaderboardsOptIn?: boolean;
  },
) {
  const user = await getOrCreateUser(userAddress);
  const existing = await prisma.gameProfile.findUnique({ where: { userId: user.id } });

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const yesterdayKey = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  const badges = new Set<string>(existing?.badges ?? []);
  let streak = existing?.streak ?? 0;
  let lastVisitDay = existing?.lastVisitDay ?? null;

  if (input.touch) {
    if (lastVisitDay !== dayKey) {
      streak = lastVisitDay === yesterdayKey ? streak + 1 : 1;
      lastVisitDay = dayKey;
    }
    if (streak >= 3) badges.add('early-bird');
    if (streak >= 7) badges.add('streak-flame');
    const hour = now.getHours();
    if (hour >= 22 || hour < 4) badges.add('night-owl');
  }

  if (input.awardBadge) badges.add(input.awardBadge);

  const stickers = existing?.stickers && typeof existing.stickers === 'object'
    ? { ...(existing.stickers as Record<string, number>) }
    : {};
  if (input.collectSticker) {
    stickers[input.collectSticker] = (stickers[input.collectSticker] ?? 0) + 1;
  }

  // Level is derived from real activity, so a genuine milestone earns the badge.
  const counts = await activityCounts(user.id);
  if (levelFromActions(counts.total) >= 3) badges.add('level-up');

  const leaderboardsOptIn = input.leaderboardsOptIn ?? existing?.leaderboardsOptIn ?? false;

  const game = await prisma.gameProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      streak,
      lastVisitDay,
      badges: [...badges],
      stickers,
      leaderboardsOptIn,
    },
    update: {
      streak,
      lastVisitDay,
      badges: [...badges],
      stickers,
      leaderboardsOptIn,
    },
  });

  return {
    level: levelFromActions(counts.total),
    counts,
    streak: game.streak,
    lastVisitDay: game.lastVisitDay,
    badges: game.badges,
    stickers: game.stickers,
    leaderboardsOptIn: game.leaderboardsOptIn,
  };
}

export async function gameLeaderboard(userAddress: string, limit = 10) {
  await getOrCreateUser(userAddress); // ensure a valid caller; entries are opt-in to appear
  const rows = await prisma.gameProfile.findMany({
    where: { leaderboardsOptIn: true },
    include: { user: true },
    orderBy: [{ updatedAt: 'asc' }],
    take: Math.max(1, Math.min(limit, 100)),
  });
  const ranked = await Promise.all(rows.map(async (r) => {
    const counts = await activityCounts(r.userId);
    return { r, counts };
  }));
  ranked.sort((a, b) => b.counts.total - a.counts.total);
  return ranked.map(({ r, counts }, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.user.username ?? r.user.walletAddress?.slice(0, 6) ?? 'explorer',
    avatarUrl: r.user.avatarUrl,
    level: levelFromActions(counts.total),
    total: counts.total,
    claims: counts.claims,
    streak: r.streak,
    badges: r.badges.length,
  }));
}

// ---------------------------------------------------------------------------
// Profile tokens (user-launched ERC-20s)
// ---------------------------------------------------------------------------

export async function recordProfileToken(input: {
  creatorAddress: string;
  name: string;
  symbol: string;
  contractAddress: string;
  chainId: number;
  maxSupply: string;
}) {
  const creator = await getOrCreateUser(input.creatorAddress);
  const contractAddress = input.contractAddress.trim().toLowerCase();
  const token = await prisma.token.upsert({
    where: { chainId_contractAddress: { chainId: input.chainId, contractAddress } },
    create: {
      creatorId: creator.id,
      name: input.name,
      symbol: input.symbol,
      chainId: input.chainId,
      contractAddress,
      maxSupply: toDecimal(input.maxSupply),
    },
    update: {
      name: input.name,
      symbol: input.symbol,
    },
  });
  return {
    id: token.id,
    name: token.name,
    symbol: token.symbol,
    contractAddress: token.contractAddress,
    chainId: token.chainId,
    maxSupply: token.maxSupply.toString(),
  };
}
