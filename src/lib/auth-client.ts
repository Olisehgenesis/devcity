'use client';

import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';

function clientBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || '';
  if (/^https?:\/\/[^/]+/i.test(raw)) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

export const authClient = createAuthClient({
  baseURL: clientBaseUrl(),
  plugins: [passkeyClient()],
});
