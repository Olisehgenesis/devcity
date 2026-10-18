import { prisma } from './prisma';
import { normalizeUsername } from './usernames';
import { friendVisibleOnMap, planFriendRequest } from './friend-rules';

export class FriendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'FriendError';
    this.status = status;
  }
}

function publicName(user: { username: string | null; profile: { username: string } | null }) {
  return user.profile?.username || user.username || '';
}

export async function sendFriendRequest(fromUserId: string, usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  if (!username) throw new FriendError(400, 'Use a username with 3–24 letters, numbers, or hyphens.');
  const target = await prisma.user.findFirst({
    where: { OR: [{ username }, { profile: { username } }] },
    select: { id: true },
  });
  const forward = target
    ? await prisma.friendRequest.findUnique({ where: { fromUserId_toUserId: { fromUserId, toUserId: target.id } } })
    : null;
  const reverse = target
    ? await prisma.friendRequest.findUnique({ where: { fromUserId_toUserId: { fromUserId: target.id, toUserId: fromUserId } } })
    : null;
  const plan = planFriendRequest(fromUserId, target?.id ?? null, forward, reverse);
  if (plan.action === 'reject' && plan.reason === 'self') {
    throw new FriendError(400, 'You cannot send a friend request to yourself.');
  }
  if (plan.action === 'reject') throw new FriendError(404, 'No account uses that username.');
  if (plan.action === 'accept-reverse') {
    await prisma.friendRequest.update({ where: { id: plan.id }, data: { status: 'ACCEPTED' } });
    return { status: 'accepted' as const };
  }
  if (plan.action === 'already-accepted') return { status: 'accepted' as const };
  if (plan.action === 'already-pending') return { status: 'pending' as const };
  if (plan.action === 'reopen') {
    await prisma.friendRequest.update({ where: { id: plan.id }, data: { status: 'PENDING' } });
    return { status: 'pending' as const };
  }
  await prisma.friendRequest.create({ data: { fromUserId, toUserId: target!.id } });
  return { status: 'pending' as const };
}

export async function respondToFriendRequest(userId: string, requestId: string, action: 'accept' | 'decline') {
  const row = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!row || row.toUserId !== userId) throw new FriendError(404, 'That friend request is not waiting for you.');
  if (row.status !== 'PENDING') throw new FriendError(409, 'That friend request was already answered.');
  await prisma.friendRequest.update({
    where: { id: row.id },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' },
  });
  return { status: action === 'accept' ? 'accepted' as const : 'declined' as const };
}

export async function listFriendDesk(userId: string) {
  const rows = await prisma.friendRequest.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include: {
      fromUser: { select: { id: true, username: true, profile: { select: { username: true, identityVerifiedAt: true, locationSharing: true } } } },
      toUser: { select: { id: true, username: true, profile: { select: { username: true, identityVerifiedAt: true, locationSharing: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const incoming = [];
  const outgoing = [];
  const friends = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const other = row.fromUserId === userId ? row.toUser : row.fromUser;
    const username = publicName(other);
    if (!username) continue;
    if (row.status === 'PENDING' && row.toUserId === userId) {
      incoming.push({ id: row.id, username, verified: Boolean(other.profile?.identityVerifiedAt) });
    } else if (row.status === 'PENDING' && row.fromUserId === userId) {
      outgoing.push({ id: row.id, username });
    } else if (row.status === 'ACCEPTED' && !seen.has(other.id)) {
      seen.add(other.id);
      friends.push({
        userId: other.id,
        username,
        verified: Boolean(other.profile?.identityVerifiedAt),
        locationOn: Boolean(other.profile?.locationSharing),
      });
    }
  }
  return { incoming, outgoing, friends };
}

function shareCoordinates(lat: number, lng: number, visibility: string) {
  if (visibility === 'VISIBLE') return { lat, lng };
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
  };
}

export async function friendMap(userId: string, now = new Date()) {
  const rows = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    include: {
      fromUser: { include: { profile: true, presence: true } },
      toUser: { include: { profile: true, presence: true } },
    },
  });
  const seen = new Set<string>();
  const friends = [];
  for (const row of rows) {
    const other = row.fromUserId === userId ? row.toUser : row.fromUser;
    if (other.id === userId || seen.has(other.id)) continue;
    seen.add(other.id);
    const profile = other.profile;
    const presence = other.presence;
    if (!profile || !presence) continue;
    if (!friendVisibleOnMap({
      locationSharing: profile.locationSharing,
      visibility: presence.visibility,
      expiresAt: presence.expiresAt,
    }, now)) continue;
    const coords = shareCoordinates(Number(presence.latitude), Number(presence.longitude), presence.visibility);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) continue;
    const username = profile.username || other.username;
    if (!username) continue;
    friends.push({
      userId: other.id,
      username,
      latitude: coords.lat,
      longitude: coords.lng,
      verified: Boolean(profile.identityVerifiedAt),
    });
  }
  return friends;
}
