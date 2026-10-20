import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import {
  devFaucetEnabled,
  devTestAccountsEnabled,
  isTestAccountEmail,
  requestAllowsTestAccounts,
  requestHostIsLocal,
  testAccountEmail,
} from './dev-test-auth';

describe('dev test accounts fail closed', () => {
  it('allows only a non-production localhost auth URL', () => {
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3000' }), true);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'test', BETTER_AUTH_URL: 'http://127.0.0.1:3000' }), true);
  });

  it('rejects production, the public host, and a missing URL', () => {
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:3000' }), false);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'development', BETTER_AUTH_URL: 'https://devcity.fun' }), false);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'development', VERCEL_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:3000' }), false);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'development', BETTER_AUTH_URL: 'https://preview.devcity.fun' }), false);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'development' }), false);
    assert.equal(devTestAccountsEnabled({ BETTER_AUTH_URL: 'http://example.com' }), false);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://devcity.fun', DEV_TEST_ACCOUNTS: '1' }), true);
    assert.equal(devTestAccountsEnabled({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://evil.example', DEV_TEST_ACCOUNTS: '1' }), false);
  });

  it('labels test accounts by their server-side email domain', () => {
    assert.equal(testAccountEmail('ada'), 'ada@test.devcity.local');
    assert.equal(isTestAccountEmail('ada@test.devcity.local'), true);
    assert.equal(isTestAccountEmail('ada@devcity.fun'), false);
  });

  it('treats a forwarded production host as remote', () => {
    const local = new Request('http://localhost:3000/api/dev/test-accounts', { headers: { host: 'localhost:3000' } });
    const forwarded = new Request('http://localhost:3000/api/dev/test-accounts', {
      headers: { host: 'localhost:3000', 'x-forwarded-host': 'devcity.fun' },
    });
    assert.equal(requestHostIsLocal(local), true);
    assert.equal(requestHostIsLocal(forwarded), false);
    const live = new Request('https://devcity.fun/api/dev/test-accounts', { headers: { host: 'devcity.fun' } });
    assert.equal(requestAllowsTestAccounts(live, { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://devcity.fun' }), false);
    assert.equal(requestAllowsTestAccounts(live, { NODE_ENV: 'production', BETTER_AUTH_URL: 'https://devcity.fun', DEV_TEST_ACCOUNTS: '1' }), true);
  });
});

describe('dev faucet fails closed', () => {
  it('refuses production and any chain other than Celo Sepolia', () => {
    assert.equal(devFaucetEnabled({ NODE_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:3000' }), false);
    assert.equal(devFaucetEnabled({ NODE_ENV: 'development', BETTER_AUTH_URL: 'https://devcity.fun' }), false);
    assert.equal(devFaucetEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_CHAIN_ID: '42220' }), false);
    assert.equal(devFaucetEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_CELO_NETWORK: 'mainnet' }), false);
    assert.equal(devFaucetEnabled({
      NODE_ENV: 'development',
      BETTER_AUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_CHAIN_ID: '11142220',
      NEXT_PUBLIC_CELO_NETWORK: 'sepolia',
    }), true);
  });
});

describe('password hashing', () => {
  it('stores a hash that verifies only the original password', async () => {
    const password = 'local-test-password-1';
    const hash = await hashPassword(password);
    assert.notEqual(hash, password);
    assert.equal(hash.includes(password), false);
    assert.equal(await verifyPassword({ hash, password }), true);
    assert.equal(await verifyPassword({ hash, password: 'local-test-password-2' }), false);
  });
});
