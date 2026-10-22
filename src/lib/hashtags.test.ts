import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHashtags } from './hashtags';

test('hashtags in a post', () => {
  assert.deepEqual(parseHashtags('Morning #Chai at #bkc and #chai'), ['chai', 'bkc']);
  assert.deepEqual(parseHashtags('no tag here, and #x is too short'), []);
});
