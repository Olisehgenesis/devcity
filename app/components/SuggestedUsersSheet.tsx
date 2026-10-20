'use client';

import { useState } from 'react';
import { useSuggestedUsers, type SuggestedUser } from '../hooks/useSuggestedUsers';
import { Sheet } from './Sheet';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AvatarBubble } from './game/AvatarBubble';

interface SuggestedUsersSheetProps {
  open: boolean;
  userAddress: string | null;
  onClose: () => void;
  onFollow: (userId: string) => void;
}

function SuggestedUserCard({ user, userAddress, onFollow }: { user: SuggestedUser; userAddress: string | null; onFollow: (userId: string) => void }) {
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function follow() {
    if (!user.walletAddress || !userAddress || busy || followed) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerAddress: userAddress, followingAddress: user.walletAddress }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not follow that person.');
      setFollowed(true);
      onFollow(user.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not follow that person.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gsheet-row">
      <AvatarBubble name={user.username} seed={user.username} tone="sky" size={44} />
      <div className="gsheet-copy">
        <strong>@{user.username}</strong>
        <span>{user.broadcastCount} posts · {user.followerCount} followers</span>
        {error && <span>{error}</span>}
      </div>
      <Button type="button" disabled={!user.walletAddress || !userAddress || busy || followed} onClick={() => void follow()}>
        <UserPlus size={14} /> {followed ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}

export function SuggestedUsersSheet({ open, userAddress, onClose, onFollow }: SuggestedUsersSheetProps) {
  const { suggestions, loading, error } = useSuggestedUsers(userAddress);

  return (
    <Sheet open={open} onClose={onClose} eyebrow="People to follow" title="Who to follow">
      <div className="gsheet">
        {loading ? (
          <div className="gsheet-loading">Scouting the city…</div>
        ) : error ? (
          <div className="gsheet-error">{error}</div>
        ) : suggestions.length === 0 ? (
          <div className="gsheet-empty">
            <strong>No suggestions yet</strong>
            <p>Come back later for people to follow.</p>
          </div>
        ) : (
          suggestions.map((user) => <SuggestedUserCard key={user.id} user={user} userAddress={userAddress} onFollow={onFollow} />)
        )}
      </div>
    </Sheet>
  );
}
