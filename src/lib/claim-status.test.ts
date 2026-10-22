import assert from 'node:assert/strict';
import test from 'node:test';
import { isRegisteredChainDrop } from './claim-status';

test('an empty on-chain drop is not a real claim count', () => {
  assert.equal(isRegisteredChainDrop({
    token: '0x0000000000000000000000000000000000000000',
    isActive: false,
  }), false);
  assert.equal(isRegisteredChainDrop([
    '0x0000000000000000000000000000000000000000',
    BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(0),
    '0x0000000000000000000000000000000000000000',
    false,
  ]), false);
});

test('a live on-chain drop keeps its claim count', () => {
  assert.equal(isRegisteredChainDrop({
    token: '0x1111111111111111111111111111111111111111',
    isActive: true,
  }), true);
});
