'use client';

import { useState } from 'react';
import { useLeaderboards, type LeaderboardEntry } from '../hooks/useLeaderboards';
import { Sheet } from './Sheet';
import { Trophy, Gift, Heart, UsersRound, Radio } from 'lucide-react';
import { avatarBackgroundForColor } from '../lib/avatars';

interface LeaderboardSheetProps {
  open: boolean;
  onClose: () => void;
}

type LeaderboardType = 'drops' | 'tips' | 'followers' | 'activity';

const TABS: { id: LeaderboardType; label: string; icon: any }[] = [
  { id: 'drops', label: 'Drops Claimed', icon: Gift },
  { id: 'tips', label: 'Tips Sent', icon: Heart },
  { id: 'followers', label: 'Followers', icon: UsersRound },
  { id: 'activity', label: 'Activity', icon: Radio },
];

function LeaderboardEntry({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const initials =
    entry.username
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || entry.username.slice(0, 2).toUpperCase();

  const tone = (() => {
    let hash = 0;
    for (let i = 0; i < entry.username.length; i++)
      hash = (hash * 31 + entry.username.charCodeAt(i)) >>> 0;
    const tones = ['coral', 'yellow', 'blue', 'pink', 'mint', 'lime', 'orange'];
    return tones[hash % tones.length];
  })();

  const rankColors = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className={`w-8 text-center font-bold ${index < 3 ? rankColors[index] : 'text-gray-500'}`}>
        #{entry.rank}
      </div>
      {entry.avatarUrl ? (
        <img src={entry.avatarUrl} alt={entry.username} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${avatarBackgroundForColor(tone)}`}
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">@{entry.username}</p>
      </div>
      <div className="text-right">
        <span className="font-semibold text-sm">{entry.count}</span>
      </div>
    </div>
  );
}

export function LeaderboardSheet({ open, onClose }: LeaderboardSheetProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('drops');
  const { leaderboards, loading, error } = useLeaderboards(activeTab);

  const entries =
    leaderboards?.[
      activeTab === 'drops'
        ? 'dropsClaimed'
        : activeTab === 'tips'
          ? 'tipsSent'
          : activeTab === 'followers'
            ? 'followers'
            : 'activity'
    ] || [];

  return (
    <Sheet open={open} onClose={onClose} title="Leaderboard">
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Trophy className="w-12 h-12 mb-2 opacity-50" />
              <p>No data yet</p>
              <p className="text-sm">Be the first to top this leaderboard</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((entry, index) => (
                <LeaderboardEntry key={entry.userId} entry={entry} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
