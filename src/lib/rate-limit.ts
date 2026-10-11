import { NextRequest } from 'next/server';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, number[]>();

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  const timestamps = rateLimitStore.get(identifier) || [];
  const validTimestamps = timestamps.filter(ts => ts > windowStart);
  
  const allowed = validTimestamps.length < config.limit;
  const remaining = Math.max(0, config.limit - validTimestamps.length - (allowed ? 1 : 0));
  const resetTime = validTimestamps.length > 0 ? validTimestamps[0] + config.windowMs : now + config.windowMs;
  
  if (allowed) {
    validTimestamps.push(now);
    rateLimitStore.set(identifier, validTimestamps);
  } else {
    rateLimitStore.set(identifier, validTimestamps);
  }
  
  return { allowed, remaining, resetTime };
}

export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig) {
  return {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };
}

export function createRateLimiter(config: RateLimitConfig) {
  return (identifier: string) => rateLimit(identifier, config);
}

export const RATE_LIMITS = {
  claimAuthorize: { limit: 10, windowMs: 60_000 },
  createDrop: { limit: 5, windowMs: 60_000 },
  updatePresence: { limit: 60, windowMs: 60_000 },
  createBroadcast: { limit: 10, windowMs: 60_000 },
  createStory: { limit: 10, windowMs: 60_000 },
} as const;

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}