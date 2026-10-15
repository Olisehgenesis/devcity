import { useState, useCallback } from 'react';

export interface SearchResult {
  users: Array<{
    id: string;
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
    walletAddress: string | null;
  }>;
  broadcasts: Array<{
    id: string;
    text: string;
    createdAt: string;
    user: {
      id: string;
      username: string | null;
      avatarUrl: string | null;
    };
    likes: number;
    comments: number;
  }>;
  events: Array<{
    id: string;
    slug: string;
    name: string;
    organizer: string;
    summary: string | null;
    category: string | null;
    location: string | null;
    startDate: string | null;
    startTime: string | null;
    url: string | null;
  }>;
  hashtags: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResult;
}

/**
 * Hook for searching across users, broadcasts, events, and hashtags
 */
export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, type: 'all' | 'users' | 'broadcasts' | 'events' | 'hashtags' = 'all') => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    search,
    clearResults,
    results,
    loading,
    error,
  };
}
