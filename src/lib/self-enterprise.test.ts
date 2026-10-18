import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selfCredentials, selfEnterpriseMode, verificationDecision } from './self-enterprise';

const testKey = 'sk_test_example';
const liveKey = 'sk_live_example';

describe('Self Enterprise environment', () => {
  it('uses the test key unless production is explicitly on Celo mainnet', () => {
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'development', NEXT_PUBLIC_CELO_NETWORK: 'sepolia' }), 'test');
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'development', NEXT_PUBLIC_CELO_NETWORK: 'mainnet', NEXT_PUBLIC_CHAIN_ID: '42220' }), 'test');
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'production', NEXT_PUBLIC_CELO_NETWORK: 'sepolia', NEXT_PUBLIC_CHAIN_ID: '11142220' }), 'test');
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'production', NEXT_PUBLIC_CHAIN_ID: '84532' }), 'test');
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'production', NEXT_PUBLIC_CELO_NETWORK: 'mainnet' }), 'live');
    assert.equal(selfEnterpriseMode({ NODE_ENV: 'production', NEXT_PUBLIC_CHAIN_ID: '42220' }), 'live');
  });

  it('refuses a live key in test mode and a test key in live mode', () => {
    const test = selfCredentials({
      NODE_ENV: 'development',
      SELF_API_KEY_TEST: testKey,
      SELF_API_KEY_LIVE: liveKey,
      SELF_FLOW_ID: 'flow-1',
      SELF_WEBHOOK_SECRET_TEST: 'whsec_test',
    });
    assert.equal(test.mode, 'test');
    assert.equal(test.apiKey, testKey);
    assert.equal(test.missing.includes('SELF_API_KEY_LIVE'), false);

    const swapped = selfCredentials({
      NODE_ENV: 'development',
      SELF_API_KEY_TEST: liveKey,
      SELF_FLOW_ID: 'flow-1',
    });
    assert.equal(swapped.apiKey, null);
    assert.equal(swapped.missing.includes('SELF_API_KEY_TEST'), true);

    const live = selfCredentials({
      NODE_ENV: 'production',
      NEXT_PUBLIC_CELO_NETWORK: 'mainnet',
      SELF_API_KEY_TEST: testKey,
      SELF_API_KEY_LIVE: liveKey,
      SELF_FLOW_ID: 'flow-1',
      SELF_WEBHOOK_SECRET_LIVE: 'whsec_live',
    });
    assert.equal(live.mode, 'live');
    assert.equal(live.apiKey, liveKey);
    assert.notEqual(live.apiKey, testKey);
  });

  it('does not mark a profile verified for an invalid, mismatched, or unconfigured proof', () => {
    const expected = { mode: 'test' as const, flowId: 'flow-1' };
    assert.equal(verificationDecision({
      type: 'verification.completed',
      status: 'valid',
      environment: 'test',
      flow_id: 'flow-1',
      external_uuid: 'user-1',
    }, expected), 'mark');
    assert.equal(verificationDecision({
      type: 'verification.completed',
      status: 'invalid',
      environment: 'test',
      flow_id: 'flow-1',
      external_uuid: 'user-1',
    }, expected), 'ignore');
    assert.equal(verificationDecision({
      type: 'verification.completed',
      status: 'valid',
      environment: 'live',
      flow_id: 'flow-1',
      external_uuid: 'user-1',
    }, expected), 'ignore');
    assert.equal(verificationDecision({
      type: 'verification.completed',
      status: 'valid',
      environment: 'test',
      flow_id: 'flow-1',
      external_uuid: 'user-1',
    }, { mode: 'live', flowId: 'flow-1' }), 'ignore');
    assert.equal(verificationDecision({
      type: 'verification.completed',
      status: 'valid',
      environment: 'test',
      flow_id: 'flow-1',
      external_uuid: 'user-1',
    }, { mode: 'test', flowId: null }), 'ignore');
  });
});
