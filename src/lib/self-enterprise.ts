export type SelfMode = 'test' | 'live';

type Env = Record<string, string | undefined>;

const CELO_MAINNET_CHAIN_ID = '42220';

export function selfEnterpriseMode(env: Env): SelfMode {
  const production = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
  const mainnet = env.NEXT_PUBLIC_CELO_NETWORK === 'mainnet' || env.NEXT_PUBLIC_CHAIN_ID === CELO_MAINNET_CHAIN_ID;
  return production && mainnet ? 'live' : 'test';
}

export function selfCallbackPath(): string {
  return '/api/webhooks/self';
}

export function selfAppBaseUrl(env: Env): string {
  const raw = env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || '';
  if (/^https?:\/\/[^/]+/i.test(raw)) return raw.replace(/\/$/, '');
  return env.NODE_ENV === 'production' ? 'https://devcity.fun' : 'http://localhost:3000';
}

export type SelfCredentials = {
  mode: SelfMode;
  apiKey: string | null;
  webhookSecret: string | null;
  flowId: string | null;
  missing: string[];
};

export function selfCredentials(env: Env): SelfCredentials {
  const mode = selfEnterpriseMode(env);
  const apiName = mode === 'live' ? 'SELF_API_KEY_LIVE' : 'SELF_API_KEY_TEST';
  const hookName = mode === 'live' ? 'SELF_WEBHOOK_SECRET_LIVE' : 'SELF_WEBHOOK_SECRET_TEST';
  const prefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  const apiKey = env[apiName]?.trim() ?? '';
  const webhookSecret = env[hookName]?.trim() ?? '';
  const flowId = env.SELF_FLOW_ID?.trim() ?? '';
  const missing: string[] = [];
  if (!apiKey.startsWith(prefix)) missing.push(apiName);
  if (!flowId) missing.push('SELF_FLOW_ID');
  if (!webhookSecret.startsWith('whsec_')) missing.push(hookName);
  return {
    mode,
    apiKey: apiKey.startsWith(prefix) ? apiKey : null,
    webhookSecret: webhookSecret.startsWith('whsec_') ? webhookSecret : null,
    flowId: flowId || null,
    missing,
  };
}

export type VerificationEvent = {
  type: string;
  status?: string;
  environment?: string;
  flow_id?: string;
  external_uuid?: string;
};

/** Mark a profile verified only for a signed, valid completion in the active environment. */
export function verificationDecision(
  event: VerificationEvent,
  expected: { mode: SelfMode; flowId: string | null },
): 'mark' | 'ignore' {
  if (event.type !== 'verification.completed') return 'ignore';
  if (event.status !== 'valid') return 'ignore';
  if (event.environment !== expected.mode) return 'ignore';
  if (!expected.flowId || event.flow_id !== expected.flowId) return 'ignore';
  if (!event.external_uuid) return 'ignore';
  return 'mark';
}
