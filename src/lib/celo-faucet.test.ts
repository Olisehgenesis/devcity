import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FaucetConfigError, readFaucetStatus, requestSepoliaFaucet } from './celo-faucet';
import { CELO_SEPOLIA_CHAIN_ID } from './chain-guard';

const address = '0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

describe('Celo Sepolia faucet', () => {
  it('matches the documented chain and request', async () => {
    assert.equal(CELO_SEPOLIA_CHAIN_ID, 11142220);
    let request: { url: string; method: string; headers: Headers; body: string } | null = null;
    const outcome = await requestSepoliaFaucet(address, {
      apiKey: 'test-key',
      pollAttempts: 1,
      sleep: async () => {},
      fetchImpl: async (url, init) => {
        if (String(url).includes('/api/faucet')) {
          request = { url: String(url), method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: String(init?.body ?? '') };
          return jsonResponse(200, { status: 'Pending', key: 'queued-key' });
        }
        return jsonResponse(200, { status: 'Pending' });
      },
    });
    assert.ok(request);
    const sent = request as { url: string; method: string; headers: Headers; body: string };
    assert.equal(sent.url, 'https://faucet.celo.org/api/faucet');
    assert.equal(sent.method, 'POST');
    assert.equal(sent.headers.get('authorization'), 'Bearer test-key');
    assert.deepEqual(JSON.parse(sent.body), { beneficiary: address, network: 'celo-sepolia' });
    assert.equal(outcome.state, 'queued');
    if (outcome.state === 'queued') assert.match(outcome.message, /not an on-chain transaction/i);
  });

  it('confirms only a settled payout with a transaction hash', async () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const outcome = await requestSepoliaFaucet(address, {
      apiKey: 'test-key',
      pollAttempts: 2,
      sleep: async () => {},
      fetchImpl: async (url) => {
        if (String(url).includes('/api/faucet')) return jsonResponse(200, { status: 'Pending', key: 'done-key' });
        return jsonResponse(200, { status: 'Done', txHash: hash, beneficiary: address });
      },
    });
    assert.deepEqual(outcome, { state: 'confirmed', statusKey: 'done-key', txHash: hash });
  });

  it('reports an invalid key, a bad address, rate limits, and a failed payout', async () => {
    await assert.rejects(() => requestSepoliaFaucet('not-an-address', { apiKey: 'test-key' }), FaucetConfigError);
    await assert.rejects(() => requestSepoliaFaucet(address, { apiKey: '' }), FaucetConfigError);

    const invalid = await requestSepoliaFaucet(address, {
      apiKey: 'bad',
      fetchImpl: async () => jsonResponse(401, { status: 'Failed', message: 'Invalid API key', error: 'invalid_api_key' }),
    });
    assert.equal(invalid.state, 'failed');
    if (invalid.state === 'failed') assert.equal(invalid.code, 'invalid_api_key');

    const limited = await requestSepoliaFaucet(address, {
      apiKey: 'test-key',
      fetchImpl: async () => jsonResponse(429, { status: 'Failed', message: 'Faucet limit exceeded', error: 'faucet_limit_exceeded' }, { 'retry-after': '60' }),
    });
    assert.equal(limited.state, 'failed');
    if (limited.state === 'failed') assert.equal(limited.retryAfterSeconds, 60);

    const failed = await readFaucetStatus('status-key', async () => jsonResponse(200, { status: 'Failed' }));
    assert.equal(failed.state, 'failed');
  });
});
