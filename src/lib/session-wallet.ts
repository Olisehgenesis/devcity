import type { Prisma } from '@prisma/client';
import { ApiError } from './api-error';
import { prisma } from './prisma';
import { normalizeWalletAddress } from './wallet-address';

type Tx = Prisma.TransactionClient;

function isShadowUser(user: { id: string; email: string | null; passkeys: { id: string }[]; accounts: { id: string }[] }, address: string) {
  return user.id === `user_${address}`
    && user.email === `${address}@devcity.local`
    && user.passkeys.length === 0
    && user.accounts.length === 0;
}

async function moveUserRow(
  shadow: unknown,
  session: unknown,
  remove: () => Promise<unknown>,
  move: () => Promise<unknown>,
) {
  if (!shadow) return;
  if (session) await remove();
  else await move();
}

async function moveGame(tx: Tx, sessionId: string, shadowId: string) {
  const shadow = await tx.gameProfile.findUnique({ where: { userId: shadowId } });
  if (!shadow) return;
  const session = await tx.gameProfile.findUnique({ where: { userId: sessionId } });
  if (!session) {
    await tx.gameProfile.update({ where: { userId: shadowId }, data: { userId: sessionId } });
    return;
  }
  const badges = Array.from(new Set([...session.badges, ...shadow.badges]));
  await tx.gameProfile.update({
    where: { userId: sessionId },
    data: { badges, streak: Math.max(session.streak, shadow.streak) },
  });
  await tx.gameProfile.delete({ where: { userId: shadowId } });
}

async function moveDropClaims(tx: Tx, sessionId: string, shadowId: string) {
  const rows = await tx.dropClaim.findMany({ where: { userId: shadowId } });
  for (const row of rows) {
    const existing = await tx.dropClaim.findUnique({
      where: { dropId_userId: { dropId: row.dropId, userId: sessionId } },
    });
    if (!existing) {
      await tx.dropClaim.update({ where: { id: row.id }, data: { userId: sessionId } });
      continue;
    }
    if (existing.status !== 'CONFIRMED' && row.status === 'CONFIRMED') {
      await tx.dropClaim.delete({ where: { id: existing.id } });
      await tx.dropClaim.update({ where: { id: row.id }, data: { userId: sessionId } });
    } else {
      await tx.dropClaim.delete({ where: { id: row.id } });
    }
  }
}

async function moveKeyed(
  rows: { key: string }[],
  clash: (key: string) => Promise<unknown>,
  remove: (key: string) => Promise<unknown>,
  create: (key: string) => Promise<unknown>,
) {
  for (const row of rows) {
    const existing = await clash(row.key);
    await remove(row.key);
    if (!existing) await create(row.key);
  }
}

async function adoptShadow(tx: Tx, sessionId: string, shadowId: string, address: string) {
  await moveUserRow(
    await tx.profile.findUnique({ where: { userId: shadowId } }),
    await tx.profile.findUnique({ where: { userId: sessionId } }),
    () => tx.profile.delete({ where: { userId: shadowId } }),
    () => tx.profile.update({ where: { userId: shadowId }, data: { userId: sessionId } }),
  );
  await moveUserRow(
    await tx.presence.findUnique({ where: { userId: shadowId } }),
    await tx.presence.findUnique({ where: { userId: sessionId } }),
    () => tx.presence.delete({ where: { userId: shadowId } }),
    () => tx.presence.update({ where: { userId: shadowId }, data: { userId: sessionId } }),
  );
  await moveUserRow(
    await tx.avatarSettings.findUnique({ where: { userId: shadowId } }),
    await tx.avatarSettings.findUnique({ where: { userId: sessionId } }),
    () => tx.avatarSettings.delete({ where: { userId: shadowId } }),
    () => tx.avatarSettings.update({ where: { userId: shadowId }, data: { userId: sessionId } }),
  );
  await moveUserRow(
    await tx.userSettings.findUnique({ where: { userId: shadowId } }),
    await tx.userSettings.findUnique({ where: { userId: sessionId } }),
    () => tx.userSettings.delete({ where: { userId: shadowId } }),
    () => tx.userSettings.update({ where: { userId: shadowId }, data: { userId: sessionId } }),
  );
  await moveGame(tx, sessionId, shadowId);
  await moveDropClaims(tx, sessionId, shadowId);

  const members = await tx.eventMember.findMany({ where: { userId: shadowId } });
  await moveKeyed(
    members.map((row) => ({ key: row.eventId })),
    (eventId) => tx.eventMember.findUnique({ where: { eventId_userId: { eventId, userId: sessionId } } }),
    (eventId) => tx.eventMember.delete({ where: { eventId_userId: { eventId, userId: shadowId } } }),
    (eventId) => tx.eventMember.create({ data: { eventId, userId: sessionId } }),
  );

  const conversations = await tx.conversationMember.findMany({ where: { userId: shadowId } });
  await moveKeyed(
    conversations.map((row) => ({ key: row.conversationId })),
    (conversationId) => tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: sessionId } } }),
    (conversationId) => tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: shadowId } } }),
    (conversationId) => {
      const row = conversations.find((item) => item.conversationId === conversationId);
      return tx.conversationMember.create({
        data: { conversationId, userId: sessionId, joinedAt: row?.joinedAt, lastReadAt: row?.lastReadAt },
      });
    },
  );

  const likes = await tx.broadcastLike.findMany({ where: { userId: shadowId } });
  await moveKeyed(
    likes.map((row) => ({ key: row.broadcastId })),
    (broadcastId) => tx.broadcastLike.findUnique({ where: { broadcastId_userId: { broadcastId, userId: sessionId } } }),
    (broadcastId) => tx.broadcastLike.delete({ where: { broadcastId_userId: { broadcastId, userId: shadowId } } }),
    (broadcastId) => tx.broadcastLike.create({ data: { broadcastId, userId: sessionId } }),
  );

  const reactions = await tx.broadcastReaction.findMany({ where: { userId: shadowId } });
  for (const row of reactions) {
    const existing = await tx.broadcastReaction.findUnique({
      where: { broadcastId_userId_emoji: { broadcastId: row.broadcastId, userId: sessionId, emoji: row.emoji } },
    });
    if (existing) await tx.broadcastReaction.delete({ where: { id: row.id } });
    else await tx.broadcastReaction.update({ where: { id: row.id }, data: { userId: sessionId } });
  }

  const rsvps = await tx.eventRsvp.findMany({ where: { userId: shadowId } });
  for (const row of rsvps) {
    const existing = await tx.eventRsvp.findUnique({
      where: { eventId_userId: { eventId: row.eventId, userId: sessionId } },
    });
    if (existing) await tx.eventRsvp.delete({ where: { id: row.id } });
    else await tx.eventRsvp.update({ where: { id: row.id }, data: { userId: sessionId } });
  }

  await tx.follow.deleteMany({
    where: {
      OR: [
        { followerId: shadowId, followingId: sessionId },
        { followerId: sessionId, followingId: shadowId },
        { followerId: shadowId, followingId: shadowId },
      ],
    },
  });
  const following = await tx.follow.findMany({ where: { followerId: shadowId } });
  for (const row of following) {
    const existing = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId: sessionId, followingId: row.followingId } },
    });
    if (existing) await tx.follow.delete({ where: { id: row.id } });
    else await tx.follow.update({ where: { id: row.id }, data: { followerId: sessionId } });
  }
  const followers = await tx.follow.findMany({ where: { followingId: shadowId } });
  for (const row of followers) {
    const existing = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId: row.followerId, followingId: sessionId } },
    });
    if (existing) await tx.follow.delete({ where: { id: row.id } });
    else await tx.follow.update({ where: { id: row.id }, data: { followingId: sessionId } });
  }

  await tx.friendRequest.deleteMany({
    where: {
      OR: [
        { fromUserId: shadowId, toUserId: sessionId },
        { fromUserId: sessionId, toUserId: shadowId },
        { fromUserId: shadowId, toUserId: shadowId },
      ],
    },
  });
  const sent = await tx.friendRequest.findMany({ where: { fromUserId: shadowId } });
  for (const row of sent) {
    const existing = await tx.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: sessionId, toUserId: row.toUserId } },
    });
    if (existing) await tx.friendRequest.delete({ where: { id: row.id } });
    else await tx.friendRequest.update({ where: { id: row.id }, data: { fromUserId: sessionId } });
  }
  const received = await tx.friendRequest.findMany({ where: { toUserId: shadowId } });
  for (const row of received) {
    const existing = await tx.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: row.fromUserId, toUserId: sessionId } },
    });
    if (existing) await tx.friendRequest.delete({ where: { id: row.id } });
    else await tx.friendRequest.update({ where: { id: row.id }, data: { toUserId: sessionId } });
  }

  await tx.token.updateMany({ where: { creatorId: shadowId }, data: { creatorId: sessionId } });
  await tx.drop.updateMany({ where: { creatorId: shadowId }, data: { creatorId: sessionId } });
  await tx.message.updateMany({ where: { senderId: shadowId }, data: { senderId: sessionId } });
  await tx.broadcast.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.broadcastComment.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.story.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.activity.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.userActivity.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.eventMessage.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.notification.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.stall.updateMany({ where: { ownerId: shadowId }, data: { ownerId: sessionId } });
  await tx.booth.updateMany({ where: { ownerId: shadowId }, data: { ownerId: sessionId } });
  await tx.walletBackup.updateMany({ where: { userId: shadowId }, data: { userId: sessionId } });
  await tx.tip.updateMany({ where: { fromUserId: shadowId }, data: { fromUserId: sessionId } });
  await tx.tip.updateMany({ where: { toUserId: shadowId }, data: { toUserId: sessionId } });

  await tx.user.update({
    where: { id: shadowId },
    data: { walletAddress: null, email: null, username: null },
  });
  await tx.user.update({ where: { id: sessionId }, data: { walletAddress: address } });
  await tx.user.delete({ where: { id: shadowId } });
}

export async function linkSessionWallet(sessionUserId: string, rawAddress: string) {
  const address = normalizeWalletAddress(rawAddress);
  const sessionUser = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!sessionUser) throw new ApiError(401, 'Sign in again to link this wallet.');
  if (sessionUser.walletAddress === address) return { userId: sessionUser.id, walletAddress: address };
  if (sessionUser.walletAddress) throw new ApiError(409, 'This account already has a different wallet.');

  const owner = await prisma.user.findUnique({
    where: { walletAddress: address },
    include: {
      passkeys: { select: { id: true }, take: 1 },
      accounts: { select: { id: true }, take: 1 },
    },
  });
  if (!owner || owner.id === sessionUser.id) {
    if (!owner) {
      try {
        await prisma.user.update({ where: { id: sessionUser.id }, data: { walletAddress: address } });
      } catch (error) {
        const again = await prisma.user.findUnique({
          where: { walletAddress: address },
          include: {
            passkeys: { select: { id: true }, take: 1 },
            accounts: { select: { id: true }, take: 1 },
          },
        });
        if (!again || !isShadowUser(again, address)) throw error;
        await prisma.$transaction((tx) => adoptShadow(tx, sessionUser.id, again.id, address), { timeout: 15_000 });
      }
    }
    return { userId: sessionUser.id, walletAddress: address };
  }
  if (!isShadowUser(owner, address)) throw new ApiError(409, 'That wallet already belongs to another account.');

  await prisma.$transaction((tx) => adoptShadow(tx, sessionUser.id, owner.id, address), { timeout: 15_000 });
  return { userId: sessionUser.id, walletAddress: address };
}
