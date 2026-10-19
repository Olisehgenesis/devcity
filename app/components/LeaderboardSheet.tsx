'use client';

import { useState } from 'react';
import { useLeaderboards, type LeaderboardEntry } from '../hooks/useLeaderboards';
import { Sheet } from './Sheet';
import { Trophy, Gift, Heart, UsersRound, Radio } from 'lucide-react';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';
import { AvatarBubble } from './game/AvatarBubble';
import { useGameStore } from '../lib/game-store';

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
  const tone = (() => {
    let hash = 0;
    for (let i = 0; i < entry.username.length; i++) hash = (hash * 31 + entry.username.charCodeAt(i)) >>> 0;
    const tones = ['coral', 'yellow', 'blue', 'pink', 'mint', 'lime', 'orange'];
    return tones[hash % tones.length];
  })();

  return (
    <div className="gsheet-row">
      <span className={`gsheet-rank${index < 3 ? ' top' : ''}`}>#{entry.rank}</span>
      <AvatarBubble
        src={entry.avatarUrl}
        name={entry.username}
        tone={tone}
        size={40}
      />
      <div className="gsheet-copy">
        <strong>@{entry.username}</strong>
      </div>
      <span className="gsheet-stat">{entry.count}</span>
    </div>
  );
}

export function LeaderboardSheet({ open, onClose }: LeaderboardSheetProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('drops');
  const { leaderboards, loading, error } = useLeaderboards(activeTab);
  const lbOptIn = useGameStore((s) => s.leaderboardsOptIn);

  const entries = leaderboards?.[
    activeTab === 'drops' ? 'dropsClaimed' : activeTab === 'tips' ? 'tipsSent' : activeTab === 'followers' ? 'followers' : 'activity'
  ] || [];

  return (
    <Sheet open={open} onClose={onClose} title="Leaderboard">
      <div className="gsheet">
        <div className="gsheet-section">
          <div className="search-tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`gsheet-chip ${activeTab === tab.id ? 'is-active' : ''}`}>
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="gsheet-loading">Racking up the scores…</div>
        ) : error ? (
          <div className="gsheet-error">{error}</div>
        ) : entries.length === 0 ? (
          <div className="gsheet-empty">
            <strong>No rankings yet</strong>
            <p>Be the first to top this leaderboard.</p>
          </div>
        ) : (
          <div className="gsheet">
            {entries.map((entry, index) => <LeaderboardEntry key={entry.userId} entry={entry} index={index} />)}
          </div>
        )}

        <div className="gsheet-card vault-room" style={{ marginTop: 12 }}>
          <div className="vault-room-head">
            <h3>Appear on leaderboards?</h3>
            <span>{lbOptIn ? 'On' : 'Off'}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Leaderboards are a friendly, non-financial game. Turn them on to let other
            people see your level and badges.
          </p>
          <button
            className="gsheet-action"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const { listLocalWallets } = await import('@/lib/keystore');
              const address = (await listLocalWallets())[0]?.address;
              if (!address) { onClose(); return; }
              await useGameStore.getState().setLeaderboardsOptIn(address, !lbOptIn);
            }}
          >
            {lbOptIn ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
