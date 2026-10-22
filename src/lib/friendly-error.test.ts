import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyError } from './friendly-error';

test('passkey cancel and a missing camera become plain sentences', () => {
  assert.equal(friendlyError(new Error('Auth cancelled'), 'Try again.'), 'Passkey sign-in was cancelled. You can try again.');
  assert.match(friendlyError(new Error('Requested device not found'), 'Camera failed.'), /No camera was found/);
  assert.equal(friendlyError(new Error(''), 'Try again.'), 'Try again.');
});
