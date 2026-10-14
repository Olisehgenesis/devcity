import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { passkey } from '@better-auth/passkey';
import { prisma } from './prisma';

function resolveBaseUrl(): string {
  const raw = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (/^https?:\/\/[^/]+/i.test(raw)) return raw.replace(/\/$/, '');
  // dotenvx-encrypted values or missing env — fall back so build/start don't crash.
  return process.env.NODE_ENV === 'production' ? 'https://devcity.fun' : 'http://localhost:3000';
}

const authUrl = resolveBaseUrl();
const authOrigin = new URL(authUrl);

export const auth = betterAuth({
  appName: 'DEVCITY26',
  baseURL: authUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  trustedOrigins: [authOrigin.origin],
  plugins: [
    passkey({
      rpID: authOrigin.hostname,
      rpName: 'DEVCITY26',
    }),
  ],
});
