import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DevTestAccountError,
  createDevTestAccount,
} from '@/lib/dev-test-accounts';
import {
  TEST_ACCOUNT_LABEL,
  devTestAccountsEnabled,
  isTestAccountEmail,
  requestHostIsLocal,
} from '@/lib/dev-test-auth';
import { normalizeUsername } from '@/lib/usernames';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function allowed(request: Request) {
  return devTestAccountsEnabled() && requestHostIsLocal(request);
}

type UsernameSignIn = {
  signInUsername: (input: {
    body: { username: string; password: string };
    headers: Headers;
    asResponse: true;
  }) => Promise<Response>;
};

export async function GET(request: Request) {
  if (!allowed(request)) return unavailable();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ enabled: true, session: null });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ enabled: true, session: null });
  return NextResponse.json({
    enabled: true,
    session: {
      id: user.id,
      username: user.username,
      label: user.name ?? TEST_ACCOUNT_LABEL,
      testAccount: isTestAccountEmail(user.email),
    },
  });
}

export async function POST(request: Request) {
  if (!allowed(request)) return unavailable();
  const body = await request.json().catch(() => null) as { action?: string; username?: string; password?: string } | null;
  const action = body?.action;
  const username = normalizeUsername(body?.username ?? '');
  const password = String(body?.password ?? '');
  try {
    if (action === 'sign-up') {
      if (!username) return NextResponse.json({ error: 'Use 3–24 letters, numbers, or hyphens.' }, { status: 400 });
      const account = await createDevTestAccount(username, password);
      const response = await (auth.api as typeof auth.api & UsernameSignIn).signInUsername({
        body: { username: account.username, password },
        headers: request.headers,
        asResponse: true,
      });
      return response;
    }
    if (action === 'sign-in') {
      if (!username) return NextResponse.json({ error: 'That username is not valid.' }, { status: 400 });
      return (auth.api as typeof auth.api & UsernameSignIn).signInUsername({
        body: { username, password },
        headers: request.headers,
        asResponse: true,
      });
    }
    if (action === 'sign-out') {
      return auth.api.signOut({ headers: request.headers, asResponse: true });
    }
    return NextResponse.json({ error: 'Choose sign-up, sign-in, or sign-out.' }, { status: 400 });
  } catch (error) {
    if (error instanceof DevTestAccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Test account request failed.';
    const status = /invalid username or password/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? 'That username or password does not match a test account.' : message }, { status });
  }
}
