'use client';

import { useEffect, useState, useCallback } from 'react';

export type SuggestedUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  broadcastCount: number;
  followerCount: number;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
};

export function useSuggestedUsers(userAddress: string | null, limit = 10) {
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSuggestions = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/suggestions?userAddress=${userAddress}&limit=${limit}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuggestions(data.suggestions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userAddress, limit]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, loading, error, refresh: fetchSuggestions };
}