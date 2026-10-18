import { createHmac, timingSafeEqual } from 'node:crypto';
import { selfAppBaseUrl, selfCallbackPath } from './self-enterprise';

export const SELF_LEGACY_SCOPE = 'devcity';
export const SELF_LEGACY_APP_NAME = 'DEVCITY';
export const SELF_LEGACY_DISCLOSURES = {} as const;

const PASS_TTL_SECONDS = 20 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Env = Record<string, string | undefined>;

export type SelfLegacyMode = 'mock' | 'real';

export function selfLegacyMode(env: Env): SelfLegacyMode {
  const production = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
  return production ? 'real' : 'mock';
}

export function selfLegacyEndpoint(env: Env): string {
  return `${selfAppBaseUrl(env)}${selfCallbackPath()}`;
}

export function selfLegacyEndpointIsPublic(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

export function selfLegacyUserId(userId: string): string | null {
  const value = userId.trim().toLowerCase();
  return UUID_PATTERN.test(value) ? value : null;
}

function passMac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`devcity-self-legacy.${body}`).digest('hex');
}

/** A short-lived pass bound to this account. The Self app carries it inside the proof. */
export function selfLegacyPass(userId: string, secret: string, now = Date.now()): string | null {
  const id = selfLegacyUserId(userId);
  if (!id || secret.length < 16) return null;
  const exp = Math.floor(now / 1000) + PASS_TTL_SECONDS;
  const body = `${id}.${exp}`;
  return `${body}.${passMac(body, secret)}`;
}

function readPass(value: string, secret: string, now: number): string | null {
  const match = /^([0-9a-f-]{36})\.(\d+)\.([0-9a-f]{64})$/i.exec(value.trim());
  if (!match || secret.length < 16) return null;
  const userId = selfLegacyUserId(match[1]);
  const exp = Number(match[2]);
  const mac = match[3].toLowerCase();
  if (!userId || !Number.isFinite(exp)) return null;
  const nowSeconds = Math.floor(now / 1000);
  if (exp < nowSeconds || exp > nowSeconds + PASS_TTL_SECONDS + 120) return null;
  const expected = passMac(`${userId}.${exp}`, secret);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return userId;
}

/** Recover the account id from the proof's user-defined data. */
export function selfLegacyBoundUser(userDefinedData: string, secret: string, now = Date.now()): string | null {
  const direct = readPass(userDefinedData, secret, now);
  if (direct) return direct;
  if (!/^[0-9a-f]+$/i.test(userDefinedData) || userDefinedData.length % 2 !== 0) return null;
  const decoded = Buffer.from(userDefinedData, 'hex').toString('utf8');
  return readPass(decoded, secret, now);
}

export type LegacyProofDecision = {
  userId: string;
  nullifier: string | null;
};

/** Mark a profile only when the proof is valid and the pass names that same account. */
export function legacyProofDecision(input: {
  isValid: boolean;
  userIdentifier: string;
  userDefinedData: string;
  nullifier?: string | null;
}, secret: string, now = Date.now()): LegacyProofDecision | null {
  if (!input.isValid) return null;
  const bound = selfLegacyBoundUser(input.userDefinedData, secret, now);
  const identifier = selfLegacyUserId(input.userIdentifier);
  if (!bound || !identifier || bound !== identifier) return null;
  const nullifier = input.nullifier?.trim() ?? '';
  return { userId: bound, nullifier: nullifier && nullifier !== '0' ? nullifier : null };
}
