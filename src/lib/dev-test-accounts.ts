import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from './prisma';
import { normalizeUsername } from './usernames';
import { TEST_ACCOUNT_LABEL, devTestAccountsEnabled, testAccountEmail } from './dev-test-auth';

export class DevTestAccountError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DevTestAccountError';
    this.status = status;
  }
}

function assertEnabled() {
  if (!devTestAccountsEnabled()) {
    throw new DevTestAccountError(404, 'Test accounts are not available.');
  }
}

export function assertTestPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new DevTestAccountError(400, 'Use a password between 12 and 128 characters.');
  }
}

export function generateTestPassword(): string {
  return randomBytes(18).toString('base64url');
}

export async function createDevTestAccount(usernameInput: string, password: string) {
  assertEnabled();
  const username = normalizeUsername(usernameInput);
  if (!username) throw new DevTestAccountError(400, 'Use 3–24 letters, numbers, or hyphens.');
  assertTestPassword(password);
  const email = testAccountEmail(username);
  const taken = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (taken) throw new DevTestAccountError(409, 'That test username is already in use.');
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        name: TEST_ACCOUNT_LABEL,
        email,
        emailVerified: true,
        username,
      },
    });
    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: passwordHash,
      },
    });
    await tx.profile.create({
      data: { userId: id, username, displayName: TEST_ACCOUNT_LABEL },
    });
  });
  return { id, username, email, label: TEST_ACCOUNT_LABEL };
}

export async function listDevTestAccounts() {
  assertEnabled();
  const rows = await prisma.user.findMany({
    where: { email: { endsWith: '@test.devcity.local' } },
    select: { username: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    username: row.username,
    label: row.name,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resetDevTestAccount(usernameInput: string) {
  assertEnabled();
  const username = normalizeUsername(usernameInput);
  if (!username) throw new DevTestAccountError(400, 'That username is not valid.');
  const user = await prisma.user.findFirst({
    where: { username, email: testAccountEmail(username) },
    include: { accounts: { where: { providerId: 'credential' } } },
  });
  if (!user || user.accounts.length === 0) {
    throw new DevTestAccountError(404, 'No test account uses that username.');
  }
  const password = generateTestPassword();
  const passwordHash = await hashPassword(password);
  await prisma.account.update({
    where: { id: user.accounts[0].id },
    data: { password: passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  return { username, password, label: TEST_ACCOUNT_LABEL };
}
