import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  legacyProofDecision,
  selfLegacyBoundUser,
  selfLegacyEndpoint,
  selfLegacyEndpointIsPublic,
  selfLegacyMode,
  selfLegacyPass,
} from './self-legacy';

const secret = 'test-secret-at-least-16';
const userId = '1792b897-e874-4ba2-951a-17dff125cb43';

describe('Self legacy', () => {
  it('uses mock documents off production and real documents on production', () => {
    assert.equal(selfLegacyMode({ NODE_ENV: 'development' }), 'mock');
    assert.equal(selfLegacyMode({ NODE_ENV: 'production', NEXT_PUBLIC_CELO_NETWORK: 'sepolia' }), 'real');
    assert.equal(selfLegacyMode({ VERCEL_ENV: 'production', NODE_ENV: 'development' }), 'real');
  });

  it('only treats a public https callback as reachable by Self', () => {
    assert.equal(selfLegacyEndpointIsPublic('http://localhost:3000/api/webhooks/self'), false);
    assert.equal(selfLegacyEndpointIsPublic('https://127.0.0.1/api/webhooks/self'), false);
    assert.equal(selfLegacyEndpointIsPublic('https://devcity.fun/api/webhooks/self'), true);
    assert.equal(selfLegacyEndpoint({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://devcity.fun' }), 'https://devcity.fun/api/webhooks/self');
  });

  it('accepts a pass only for the account it was issued to, until it expires', () => {
    const now = Date.UTC(2026, 9, 18, 8, 0, 0);
    const pass = selfLegacyPass(userId, secret, now);
    assert.ok(pass);
    assert.equal(selfLegacyBoundUser(pass, secret, now + 1000), userId);
    assert.equal(selfLegacyBoundUser(Buffer.from(pass).toString('hex'), secret, now + 1000), userId);
    assert.equal(selfLegacyBoundUser(pass, secret, now + 21 * 60 * 1000), null);
    assert.equal(selfLegacyBoundUser(pass.replace(userId, 'ff0c0a4b-c46a-4357-8bce-3ea4d6cf5687'), secret, now), null);
    assert.equal(selfLegacyPass('not-a-uuid', secret, now), null);
  });

  it('marks a profile only for a valid proof bound to that account', () => {
    const now = Date.UTC(2026, 9, 18, 8, 0, 0);
    const pass = selfLegacyPass(userId, secret, now);
    assert.ok(pass);
    assert.deepEqual(legacyProofDecision({
      isValid: true,
      userIdentifier: userId.toUpperCase(),
      userDefinedData: Buffer.from(pass).toString('hex'),
      nullifier: 'abc',
    }, secret, now), { userId, nullifier: 'abc' });
    assert.equal(legacyProofDecision({
      isValid: false,
      userIdentifier: userId,
      userDefinedData: pass,
      nullifier: 'abc',
    }, secret, now), null);
    assert.equal(legacyProofDecision({
      isValid: true,
      userIdentifier: 'ff0c0a4b-c46a-4357-8bce-3ea4d6cf5687',
      userDefinedData: pass,
      nullifier: 'abc',
    }, secret, now), null);
  });
});
