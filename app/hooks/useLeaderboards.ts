'use client';

import { useEffect, useState, useCallback } from 'react';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  count: number;
};

export type Leaderboards = {
  dropsClaimed?: LeaderboardEntry[];
  tipsSent?: LeaderboardEntry[];
  followers?: LeaderboardEntry[];
  activity?: LeaderboardEntry[];
};

export function useLeaderboards(type = 'all', limit = 10) {
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLeaderboards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/leaderboards?type=${type}&limit=${limit}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeaderboards(data.leaderboards);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type, limit]);

  useEffect(() => {
    fetchLeaderboards();
  }, [fetchLeaderboards]);

  return { leaderboards, loading, error, refresh: fetchLeaderboards };
}