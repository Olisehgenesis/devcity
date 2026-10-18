import assert from 'node:assert/strict';
import test from 'node:test';
import { originalAvatarDataUri } from './original-avatar';

test('avatars are original inline drawings', () => {
  const uri = originalAvatarDataUri('qa-oct17');
  assert.match(uri, /^data:image\/svg\+xml,/);
  assert.equal(uri.includes('dicebear'), false);
  assert.equal(uri.includes('api.'), false);
  assert.notEqual(originalAvatarDataUri('qa-oct17'), originalAvatarDataUri('qa-oct17b'));
});
