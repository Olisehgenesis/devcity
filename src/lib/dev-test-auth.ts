type Env = Record<string, string | undefined>;

export const TEST_ACCOUNT_LABEL = 'Test account';
export const TEST_ACCOUNT_EMAIL_DOMAIN = 'test.devcity.local';

function hostnameOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProductionHost(hostname: string | null): boolean {
  return hostname === 'devcity.fun' || Boolean(hostname?.endsWith('.devcity.fun'));
}

function isLocalHost(hostname: string | null): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Username/password test accounts exist only on a local, non-production process.
 * A client flag cannot enable this. Missing or production configuration fails closed.
 */
export function devTestAccountsEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.VERCEL_ENV === 'production') return false;
  const host = hostnameOf(env.BETTER_AUTH_URL);
  if (!host || isProductionHost(host) || !isLocalHost(host)) return false;
  return true;
}

/** Celo Sepolia faucet calls are server-side and refused for production hosts. */
export function devFaucetEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.VERCEL_ENV === 'production') return false;
  const host = hostnameOf(env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL);
  if (isProductionHost(host)) return false;
  if (env.NEXT_PUBLIC_CHAIN_ID && env.NEXT_PUBLIC_CHAIN_ID !== '11142220') return false;
  if (env.NEXT_PUBLIC_CELO_NETWORK && env.NEXT_PUBLIC_CELO_NETWORK !== 'sepolia') return false;
  return true;
}

export function requestHostIsLocal(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-host') ?? '';
  if (/devcity\.fun/i.test(forwarded)) return false;
  const host = (request.headers.get('host') ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return isLocalHost(host);
}

export function testAccountEmail(username: string): string {
  return `${username}@${TEST_ACCOUNT_EMAIL_DOMAIN}`;
}

export function isTestAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${TEST_ACCOUNT_EMAIL_DOMAIN}`));
}
