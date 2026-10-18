import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { passkey } from '@better-auth/passkey';
import { username } from 'better-auth/plugins/username';
import { prisma } from './prisma';
import { devTestAccountsEnabled } from './dev-test-auth';
import { normalizeUsername } from './usernames';

function resolveBaseUrl(): string {
  const raw = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (/^https?:\/\/[^/]+/i.test(raw)) return raw.replace(/\/$/, '');
  // dotenvx-encrypted values or missing env — fall back so build/start don't crash.
  return process.env.NODE_ENV === 'production' ? 'https://devcity.fun' : 'http://localhost:3000';
}

const authUrl = resolveBaseUrl();
const authOrigin = new URL(authUrl);
const devAccounts = devTestAccountsEnabled();

export const auth = betterAuth({
  appName: 'DEVCITY26',
  baseURL: authUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: devAccounts,
    requireEmailVerification: false,
  },
  trustedOrigins: [authOrigin.origin],
  plugins: [
    ...(devAccounts ? [username({
      minUsernameLength: 3,
      maxUsernameLength: 24,
      displayUsername: false,
      usernameValidator: (value) => /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/i.test(value),
    })] : []),
    passkey({
      rpID: authOrigin.hostname,
      rpName: 'DEVCITY26',
      registration: {
        requireSession: false,
        resolveUser: async ({ context }) => {
          const username = typeof context === 'string' ? normalizeUsername(context) : null;
          if (!username) {
            throw new APIError('BAD_REQUEST', {
              message: 'Choose a valid username before creating your passkey.',
            });
          }
          const id = randomUUID();
          return {
            id,
            name: username,
            displayName: username,
          };
        },
        afterVerification: async ({ user, context }) => {
          const username = typeof context === 'string' ? normalizeUsername(context) : null;
          if (!username) {
            throw new APIError('BAD_REQUEST', {
              message: 'The username is invalid. Please restart account creation.',
            });
          }
          await prisma.$transaction(async (tx) => {
            await tx.user.create({
              data: { id: user.id, name: username, username },
            });
            await tx.profile.create({
              data: { userId: user.id, username, displayName: username },
            });
          });
          return { userId: user.id };
        },
      },
    }),
  ],
});
