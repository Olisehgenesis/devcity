import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { friendVisibleOnMap, planFriendRequest, type FriendRow } from './friend-rules';

const pending = (fromUserId: string, toUserId: string): FriendRow => ({
  id: `${fromUserId}->${toUserId}`,
  fromUserId,
  toUserId,
  status: 'PENDING',
});

describe('friend requests', () => {
  it('rejects a request to yourself and accepts a pending request sent the other way', () => {
    assert.deepEqual(planFriendRequest('me', 'me', null, null), { action: 'reject', reason: 'self' });
    assert.deepEqual(planFriendRequest('me', null, null, null), { action: 'reject', reason: 'unknown-user' });
    assert.deepEqual(planFriendRequest('me', 'them', null, pending('them', 'me')), { action: 'accept-reverse', id: 'them->me' });
  });

  it('keeps an existing friendship and does not create a second pending request', () => {
    assert.equal(planFriendRequest('me', 'them', { ...pending('me', 'them'), status: 'ACCEPTED' }, null).action, 'already-accepted');
    assert.equal(planFriendRequest('me', 'them', pending('me', 'them'), null).action, 'already-pending');
    assert.equal(planFriendRequest('me', 'them', null, null).action, 'create');
  });

  it('hides a friend on the map when location is off, invisible, or expired', () => {
    const now = new Date('2026-10-18T00:00:00Z');
    const later = new Date('2026-10-18T01:00:00Z');
    const earlier = new Date('2026-10-17T01:00:00Z');
    assert.equal(friendVisibleOnMap({ locationSharing: true, visibility: 'APPROXIMATE', expiresAt: later }, now), true);
    assert.equal(friendVisibleOnMap({ locationSharing: false, visibility: 'VISIBLE', expiresAt: later }, now), false);
    assert.equal(friendVisibleOnMap({ locationSharing: true, visibility: 'INVISIBLE', expiresAt: later }, now), false);
    assert.equal(friendVisibleOnMap({ locationSharing: true, visibility: 'VISIBLE', expiresAt: earlier }, now), false);
  });
});
