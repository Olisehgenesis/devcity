export type FriendStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type FriendRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendStatus;
};

export type FriendPlan =
  | { action: 'reject'; reason: 'self' | 'unknown-user' }
  | { action: 'already-accepted' }
  | { action: 'already-pending' }
  | { action: 'accept-reverse'; id: string }
  | { action: 'reopen'; id: string }
  | { action: 'create' };

export function planFriendRequest(me: string, them: string | null, forward: FriendRow | null, reverse: FriendRow | null): FriendPlan {
  if (!them) return { action: 'reject', reason: 'unknown-user' };
  if (me === them) return { action: 'reject', reason: 'self' };
  if (reverse?.status === 'PENDING') return { action: 'accept-reverse', id: reverse.id };
  if (reverse?.status === 'ACCEPTED' || forward?.status === 'ACCEPTED') return { action: 'already-accepted' };
  if (forward?.status === 'PENDING') return { action: 'already-pending' };
  if (forward?.status === 'DECLINED') return { action: 'reopen', id: forward.id };
  return { action: 'create' };
}

export function friendVisibleOnMap(friend: {
  locationSharing: boolean;
  visibility: string;
  expiresAt: Date;
}, now: Date): boolean {
  return friend.locationSharing
    && friend.visibility !== 'INVISIBLE'
    && friend.expiresAt.getTime() >= now.getTime();
}
