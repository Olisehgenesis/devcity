'use client';

import { useSuggestedUsers, type SuggestedUser } from '../hooks/useSuggestedUsers';
import { Sheet } from './Sheet';
import { UsersRound, UserPlus, Circle } from 'lucide-react';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';

interface SuggestedUsersSheetProps {
  open: boolean;
  userAddress: string | null;
  onClose: () => void;
  onFollow: (userId: string) => void;
}

function SuggestedUserCard({
  user,
  onFollow,
}: {
  user: SuggestedUser;
  onFollow: (userId: string) => void;
}) {
  const initials = user.username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || user.username.slice(0, 2).toUpperCase();

  const tone = (() => {
    let hash = 0;
    for (let i = 0; i < user.username.length; i++)
      hash = (hash * 31 + user.username.charCodeAt(i)) >>> 0;
    const tones = ['coral', 'yellow', 'blue', 'pink', 'mint', 'lime', 'orange'];
    return tones[hash % tones.length];
  })();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="relative">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${avatarBackgroundForColor(tone)}`}
          >
            {initials}
          </div>
        )}
        {user.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">@{user.username}</p>
        <p className="text-xs text-gray-500">
          {user.broadcastCount} posts · {user.followerCount} followers
        </p>
      </div>
      <button
        onClick={() => onFollow(user.id)}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Follow
      </button>
    </div>
  );
}

export function SuggestedUsersSheet({
  open,
  userAddress,
  onClose,
  onFollow,
}: SuggestedUsersSheetProps) {
  const { suggestions, loading, error } = useSuggestedUsers(userAddress);

  return (
    <Sheet open={open} onClose={onClose} title="Suggested Users">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <UsersRound className="w-5 h-5" />
          <span className="font-semibold">People to Follow</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <UsersRound className="w-12 h-12 mb-2 opacity-50" />
              <p>No suggestions yet</p>
              <p className="text-sm">Check back later for people to follow</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {suggestions.map((user) => (
                <SuggestedUserCard key={user.id} user={user} onFollow={onFollow} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}