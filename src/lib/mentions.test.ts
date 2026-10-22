import assert from 'node:assert/strict';
import test from 'node:test';
import { canReplyTo, insertMention, mentionBeingTyped, parseMentions } from './mentions';

test('mentions and reply targets', () => {
  assert.deepEqual(parseMentions('Hey @priya and @priya, meet @amy-1'), ['priya', 'amy-1']);
  assert.deepEqual(parseMentions('email me at a@bc.com and @ab'), []);
  assert.equal(mentionBeingTyped('hello @pri', 10), 'pri');
  assert.equal(mentionBeingTyped('hello @priya ', 13), null);
  const inserted = insertMention('hey @pr', 7, 'priya');
  assert.equal(inserted.text, 'hey @priya ');
  assert.equal(inserted.caret, 11);
  assert.equal(canReplyTo({ broadcastId: 'post', parentId: null }, 'post'), true);
  assert.equal(canReplyTo({ broadcastId: 'post', parentId: 'root' }, 'post'), false);
  assert.equal(canReplyTo({ broadcastId: 'other', parentId: null }, 'post'), false);
  assert.equal(canReplyTo(null, 'post'), false);
});
