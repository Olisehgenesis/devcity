import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FeeUnpayableError, feePreference, formatFeeAmount, orderFeeCandidates, sortFeeSymbols } from './gas';

describe('celo fee currency order', () => {
  it('pays CELO conceptually first, then USDT including USD₮, then USDC, then other tokens', () => {
    assert.equal(feePreference('USDT'), 0);
    assert.equal(feePreference('USD₮'), 0);
    assert.equal(feePreference('USDC'), 1);
    assert.ok(feePreference('USA₮') > feePreference('USDC'));
    const sorted = sortFeeSymbols(['EURm', 'USDC', 'USD₮', 'cUSD']);
    assert.deepEqual(sorted.slice(0, 2), ['USD₮', 'USDC']);
    assert.ok(sorted.indexOf('USDC') < sorted.indexOf('EURm'));
  });

  it('tries a requested fee currency first and ignores an unknown one', () => {
    const automatic = [{ symbol: 'CELO' }, { symbol: 'USDT' }, { symbol: 'USDC' }];
    assert.deepEqual(orderFeeCandidates(automatic, 'USDC').map((item) => item.symbol), ['USDC', 'CELO', 'USDT']);
    assert.deepEqual(orderFeeCandidates(automatic, 'auto').map((item) => item.symbol), ['CELO', 'USDT', 'USDC']);
    assert.deepEqual(orderFeeCandidates(automatic, 'cEUR').map((item) => item.symbol), ['CELO', 'USDT', 'USDC']);
  });

  it('formats an 18-decimal fee without claiming a zero balance', () => {
    assert.equal(formatFeeAmount(BigInt('1500000000000000')), '0.0015');
  });

  it('names every currency that was checked when none can pay', () => {
    const error = new FeeUnpayableError([
      { symbol: 'CELO', needed: '0.002 CELO', balance: '0 CELO', enough: false },
      { symbol: 'USDT', needed: '0.01 USDT', balance: '0 USDT', enough: false },
      { symbol: 'USDC', needed: '0.01 USDC', balance: '0 USDC', enough: false },
    ]);
    assert.match(error.message, /CELO/);
    assert.match(error.message, /USDT/);
    assert.match(error.message, /USDC/);
    assert.match(error.message, /need about 0.01 USDT/);
  });
});
