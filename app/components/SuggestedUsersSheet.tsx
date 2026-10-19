'use client';

import { useSuggestedUsers, type SuggestedUser } from '../hooks/useSuggestedUsers';
import { Sheet } from './Sheet';
import { UserPlus } from 'lucide-react';
import { AvatarBubble } from './game/AvatarBubble';

interface SuggestedUsersSheetProps {
  open: boolean;
  userAddress: string | null;
  onClose: () => void;
  onFollow: (userId: string) => void;
}

function SuggestedUserCard({ user, onFollow }: { user: SuggestedUser; onFollow: (userId: string) => void }) {
  return (
    <div className="gsheet-row">
      <AvatarBubble name={user.username} seed={user.username} tone="sky" size={44} />
      <div className="gsheet-copy">
        <strong>@{user.username}</strong>
        <span>{user.broadcastCount} posts · {user.followerCount} followers</span>
      </div>
      <button className="gsheet-action" onClick={() => onFollow(user.id)}><UserPlus size={14} /> Follow</button>
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
          suggestions.map((user) => <SuggestedUserCard key={user.id} user={user} onFollow={onFollow} />)
        )}
      </div>
    </Sheet>
  );
}
