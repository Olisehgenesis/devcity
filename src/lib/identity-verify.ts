import { prisma } from './prisma';

export type MarkVerifiedResult = 'marked' | 'already' | 'missing-user' | 'duplicate' | 'no-profile';

export async function markIdentityVerified(userId: string, nullifier: string | null): Promise<MarkVerifiedResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, profile: { select: { id: true, identityVerifiedAt: true } } },
  });
  if (!user) return 'missing-user';
  if (user.profile?.identityVerifiedAt) return 'already';
  if (nullifier) {
    const owner = await prisma.profile.findUnique({ where: { selfNullifier: nullifier }, select: { userId: true } });
    if (owner && owner.userId !== user.id) return 'duplicate';
  }
  const data = {
    identityVerifiedAt: new Date(),
    ...(nullifier ? { selfNullifier: nullifier } : {}),
  };
  if (user.profile) {
    await prisma.profile.update({ where: { userId: user.id }, data });
    return 'marked';
  }
  if (!user.username) return 'no-profile';
  await prisma.profile.create({
    data: { userId: user.id, username: user.username, ...data },
  });
  return 'marked';
}
