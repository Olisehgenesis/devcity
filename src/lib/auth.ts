import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { passkey } from '@better-auth/passkey';
import { prisma } from './prisma';

const authUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
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