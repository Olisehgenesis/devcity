import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from './api-error';
import { normalizeWalletAddress } from './wallet-address';

describe('wallet address', () => {
  it('accepts a 20-byte hex address and lowercases it', () => {
    assert.equal(
      normalizeWalletAddress('0xABCD000000000000000000000000000000000001'),
      '0xabcd000000000000000000000000000000000001',
    );
  });

  it('rejects a missing or malformed address', () => {
    for (const value of [undefined, '', '0x123', 'wallet']) {
      assert.throws(() => normalizeWalletAddress(value), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 400);
        return true;
      });
    }
  });
});
