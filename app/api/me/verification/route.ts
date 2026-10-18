import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { selfAppBaseUrl, selfCallbackPath } from '@/lib/self-enterprise';
import {
  SELF_LEGACY_APP_NAME,
  SELF_LEGACY_DISCLOSURES,
  SELF_LEGACY_SCOPE,
  selfLegacyEndpoint,
  selfLegacyEndpointIsPublic,
  selfLegacyMode,
  selfLegacyPass,
  selfLegacyUserId,
} from '@/lib/self-legacy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function sessionUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

function verificationView(env: NodeJS.ProcessEnv) {
  const endpoint = selfLegacyEndpoint(env);
  const mode = selfLegacyMode(env);
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? '';
  const configured = selfLegacyEndpointIsPublic(endpoint) && secret.length >= 16;
  return {
    mode: mode === 'real' ? 'live' as const : 'test' as const,
    configured,
    missing: configured ? [] : ['a public https callback'],
    callbackPath: selfCallbackPath(),
    endpoint,
    provider: 'legacy' as const,
  };
}

export async function GET(request: Request) {
  const userId = await sessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to see verification.' }, { status: 401 });
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { identityVerifiedAt: true },
  });
  return NextResponse.json({
    verified: Boolean(profile?.identityVerifiedAt),
    ...verificationView(process.env),
  });
}

export async function POST(request: Request) {
  const userId = await sessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in before getting verified.' }, { status: 401 });
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { identityVerifiedAt: true },
  });
  if (profile?.identityVerifiedAt) {
    return NextResponse.json({ ...verificationView(process.env), verified: true });
  }
  const view = verificationView(process.env);
  const accountId = selfLegacyUserId(userId);
  const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? '';
  const pass = accountId ? selfLegacyPass(accountId, secret) : null;
  if (!view.configured || !pass || !accountId) {
    return NextResponse.json({
      ...view,
      error: 'Self can only send proofs to a public https address.',
    }, { status: 503 });
  }
  const base = selfAppBaseUrl(process.env);
  return NextResponse.json({
    ...view,
    appName: SELF_LEGACY_APP_NAME,
    scope: SELF_LEGACY_SCOPE,
    endpointType: view.mode === 'live' ? 'https' : 'staging_https',
    userId: accountId,
    userIdType: 'uuid',
    userDefinedData: pass,
    logo: `${base}/icons/apple-touch-icon.png`,
    returnUrl: `${base}/?self=done`,
    disclosures: SELF_LEGACY_DISCLOSURES,
  });
}
