'use client';

import { useEffect, useState, useCallback } from 'react';

export type TrendingBroadcast = {
  id: string;
  text: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  likes: number;
  comments: number;
  createdAt: string;
};

export type TrendingHashtag = {
  id: string;
  tag: string;
  usageCount: number;
};

export type TrendingEvent = {
  id: string;
  name: string;
  organizer: string;
  category: string | null;
  startDate: string | null;
  rsvpCount: number;
};

export type TrendingData = {
  broadcasts: TrendingBroadcast[];
  hashtags: TrendingHashtag[];
  events: TrendingEvent[];
};

export function useTrending(limit = 10) {
  const [data, setData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/trending?limit=${limit}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return { data, loading, error, refresh: fetchTrending };
}