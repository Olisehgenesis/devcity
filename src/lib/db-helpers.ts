import { prisma } from './db';

/**
 * Get or create user by wallet address
 */
export async function getOrCreateUser(walletAddress: string, username?: string) {
  return prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: {
      walletAddress,
      username: username || `user-${walletAddress.slice(0, 6)}`,
    },
  });
}

/**
 * List active drops
 */
export async function listActiveDrops(limit = 20, offset = 0) {
  const now = new Date();
  return prisma.drop.findMany({
    where: {
      expiresAt: { gt: now },
    },
    include: { token: true },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Check if user has already claimed from a drop
 */
export async function hasUserClaimed(userId: string, dropId: string) {
  const claim = await prisma.claim.findUnique({
    where: {
      dropId_userId: { dropId, userId },
    },
  });
  return !!claim;
}

/**
 * Create a claim
 */
export async function createClaim(
  userId: string,
  dropId: string,
  tokenId: string,
  amount: bigint,
  txHash?: string
) {
  const existing = await hasUserClaimed(userId, dropId);
  if (existing) {
    throw new Error('User has already claimed from this drop');
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.create({
      data: {
        userId,
        dropId,
        tokenId,
        amount,
        txHash,
      },
    });

    await tx.drop.update({
      where: { id: dropId },
      data: { currentClaimants: { increment: 1 } },
    });

    return claim;
  });
}

/**
 * Get user's claim history
 */
export async function getUserClaims(userId: string, limit = 20) {
  return prisma.claim.findMany({
    where: { userId },
    include: { drop: true, token: true },
    orderBy: { claimedAt: 'desc' },
    take: limit,
  });
}

/**
 * Update user presence
 */
export async function updatePresence(
  userId: string,
  latitude: number,
  longitude: number,
  visibility: string,
  status: string
) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  return prisma.presence.upsert({
    where: { userId },
    update: {
      latitude,
      longitude,
      visibility,
      status,
      lastUpdated: new Date(),
      expiresAt,
    },
    create: {
      userId,
      latitude,
      longitude,
      visibility,
      status,
      expiresAt,
    },
  });
}

/**
 * Get nearby users (respecting privacy)
 */
export async function getNearbyUsers(
  latitude: number,
  longitude: number,
  radiusKm = 1
) {
  const now = new Date();

  const presences = await prisma.presence.findMany({
    where: {
      expiresAt: { gt: now },
    },
    include: { user: true },
  });

  return presences
    .filter((p) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        p.latitude,
        p.longitude
      );
      return distance <= radiusKm;
    })
    .map((p) => ({
      userAddress: p.user.walletAddress,
      username: p.user.username,
      avatarUrl: p.user.avatarUrl,
      status: p.status,
      distance: calculateDistance(
        latitude,
        longitude,
        p.latitude,
        p.longitude
      ),
      location:
        p.visibility === 'approximate'
          ? {
              lat: Math.round(p.latitude * 100) / 100,
              lng: Math.round(p.longitude * 100) / 100,
            }
          : { lat: p.latitude, lng: p.longitude },
    }));
}

/**
 * Create broadcast
 */
export async function createBroadcast(userId: string, text: string) {
  const trimmed = text.trim().slice(0, 240);
  if (!trimmed) throw new Error('Broadcast text is empty');

  return prisma.broadcast.create({
    data: {
      userId,
      text: trimmed,
    },
    include: {
      user: true,
      broadcastLikes: true,
      broadcastComments: { include: { user: true } },
    },
  });
}

/**
 * Get broadcasts
 */
export async function getBroadcasts(limit = 20, offset = 0) {
  return prisma.broadcast.findMany({
    include: {
      user: true,
      broadcastLikes: true,
      broadcastComments: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Add comment to broadcast
 */
export async function addBroadcastComment(
  broadcastId: string,
  userId: string,
  text: string
) {
  const trimmed = text.trim().slice(0, 240);
  if (!trimmed) throw new Error('Comment text is empty');

  return prisma.broadcastComment.create({
    data: {
      broadcastId,
      userId,
      text: trimmed,
    },
    include: { user: true },
  });
}

/**
 * Toggle broadcast like
 */
export async function toggleBroadcastLike(broadcastId: string, userId: string) {
  const existing = await prisma.broadcastLike.findUnique({
    where: {
      broadcastId_userId: { broadcastId, userId },
    },
  });

  if (existing) {
    await prisma.broadcastLike.delete({
      where: {
        broadcastId_userId: { broadcastId, userId },
      },
    });
    return { liked: false };
  } else {
    await prisma.broadcastLike.create({
      data: {
        broadcastId,
        userId,
      },
    });
    return { liked: true };
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
