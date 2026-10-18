import { NextResponse } from 'next/server';
import { FaucetConfigError, requestSepoliaFaucet } from '@/lib/celo-faucet';
import { devFaucetEnabled, requestHostIsLocal } from '@/lib/dev-test-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!devFaucetEnabled() || !requestHostIsLocal(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => null) as { confirm?: boolean; beneficiary?: string; address?: string } | null;
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'Set confirm to true. This does not fund a wallet on its own.' }, { status: 400 });
  }
  try {
    const outcome = await requestSepoliaFaucet(String(body.beneficiary ?? body.address ?? ''));
    const headers = new Headers();
    if (outcome.state === 'failed' && outcome.retryAfterSeconds != null) {
      headers.set('Retry-After', String(outcome.retryAfterSeconds));
    }
    const status = outcome.state === 'failed'
      ? outcome.code === 'invalid_api_key' || outcome.code === 'api_key_disabled' ? 401
        : outcome.code === 'faucet_limit_exceeded' ? 429
          : 400
      : 200;
    return NextResponse.json(outcome, { status, headers });
  } catch (error) {
    const message = error instanceof FaucetConfigError ? error.message : 'The faucet request failed.';
    return NextResponse.json({ state: 'failed', message }, { status: 400 });
  }
}
