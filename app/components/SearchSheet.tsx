'use client';

import { useState, useEffect } from 'react';
import { Calendar, Hash, MessageCircle, Radio, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from './Sheet';
import { useSearch, type SearchResult } from '../hooks/useSearch';

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  onMessageUser?: (address: string, username: string) => void;
  onOpenUser?: (username: string) => void;
  initialQuery?: string;
}

type TagPost = { id: string; text: string; username: string | null; likes: number; comments: number };

type SearchTab = 'all' | 'users' | 'broadcasts' | 'events' | 'hashtags';

const TABS: { id: SearchTab; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'users', label: 'People', icon: Users },
  { id: 'broadcasts', label: 'Posts', icon: Radio },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'hashtags', label: 'Tags', icon: Hash },
];

export function SearchSheet({ open, onClose, onMessageUser, onOpenUser, initialQuery = '' }: SearchSheetProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [tags, setTags] = useState<Array<{ tag: string; usageCount: number }>>([]);
  const [tagPosts, setTagPosts] = useState<{ tag: string; posts: TagPost[] } | null>(null);
  const [tagError, setTagError] = useState('');
  const { search, results, loading, error, clearResults } = useSearch();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setTagPosts(null);
      setTagError('');
      clearResults();
      return;
    }
    if (initialQuery) setQuery(initialQuery);
    void fetch('/api/hashtags?limit=8')
      .then((response) => response.ok ? response.json() : null)
      .then((data: { hashtags?: Array<{ tag: string; usageCount: number }> } | null) => {
        setTags(data?.hashtags ?? []);
      })
      .catch(() => undefined);
  }, [open, clearResults, initialQuery]);

  async function openTag(tag: string) {
    setTagError('');
    setTagPosts(null);
    setActiveTab('hashtags');
    const response = await fetch(`/api/hashtags/${encodeURIComponent(tag)}`);
    const data = await response.json().catch(() => ({})) as { error?: string; broadcasts?: TagPost[] };
    if (!response.ok) {
      setTagError(data.error || 'No posts use that tag yet.');
      return;
    }
    setTagPosts({ tag, posts: data.broadcasts ?? [] });
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (query.length >= 2) {
        search(query, activeTab);
      } else {
        clearResults();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, activeTab, search, clearResults]);

  const tabResults = results || { users: [], broadcasts: [], events: [], hashtags: [] };

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Search the city" title="Find anything">
      <div className="search-sheet">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search users, posts, events, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="search-clear" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`search-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && <p className="search-error">{error}</p>}

        {loading && <p className="search-loading">Searching...</p>}

        {!loading && !error && query.length >= 2 && (
          <div className="search-results">
            {activeTab === 'all' || activeTab === 'users' ? (
              <div className="search-section">
                <h3>People</h3>
                {tabResults.users.length === 0 ? (
                  <p className="search-empty">No people found</p>
                ) : (
                  <ul className="search-list">
                    {tabResults.users.map((user) => (
                      <li key={user.id} className="search-item search-item-user">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="search-avatar" />
                        ) : (
                          <div className="search-avatar-placeholder">{user.username?.slice(0, 2) || '??'}</div>
                        )}
                        <button type="button" className="search-item-content" onClick={() => user.username && onOpenUser?.(user.username)}>
                          <strong>{user.username || user.name || 'Anonymous'}</strong>
                          <span>{user.walletAddress ? `${user.walletAddress.slice(0, 8)}…` : 'No wallet linked'}</span>
                        </button>
                        {user.walletAddress && onMessageUser && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => onMessageUser(user.walletAddress!, user.username || user.name || '')}
                            aria-label={`Message ${user.username || user.name}`}
                          >
                            <MessageCircle size={15} /> Message
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {activeTab === 'all' || activeTab === 'broadcasts' ? (
              <div className="search-section">
                <h3>Posts</h3>
                {tabResults.broadcasts.length === 0 ? (
                  <p className="search-empty">No posts found</p>
                ) : (
                  <ul className="search-list">
                    {tabResults.broadcasts.map((broadcast) => (
                      <li key={broadcast.id} className="search-item search-item-broadcast">
                        <div className="search-item-content">
                          <p>{broadcast.text}</p>
                          <span className="search-meta">
                            By {broadcast.user.username} · {broadcast.likes} likes · {broadcast.comments} comments
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {activeTab === 'all' || activeTab === 'events' ? (
              <div className="search-section">
                <h3>Events</h3>
                {tabResults.events.length === 0 ? (
                  <p className="search-empty">No events found</p>
                ) : (
                  <ul className="search-list">
                    {tabResults.events.map((event) => (
                      <li key={event.id} className="search-item search-item-event">
                        <div className="search-item-content">
                          <strong>{event.name}</strong>
                          <span>{event.organizer}</span>
                          {event.location && <span>{event.location}</span>}
                          {event.startDate && <span>{new Date(event.startDate).toLocaleDateString()}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {activeTab === 'all' || activeTab === 'hashtags' ? (
              <div className="search-section">
                <h3>Hashtags</h3>
                {tabResults.hashtags.length === 0 ? (
                  <p className="search-empty">No hashtags found</p>
                ) : (
                  <div className="search-hashtags">
                    {tabResults.hashtags.map((tag) => (
                      <button key={tag} type="button" className="search-hashtag" onClick={() => void openTag(tag)}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {!loading &&
              !error &&
              tabResults.users.length === 0 &&
              tabResults.broadcasts.length === 0 &&
              tabResults.events.length === 0 &&
              tabResults.hashtags.length === 0 && (
                <p className="search-empty">No results found for &ldquo;{query}&rdquo;</p>
              )}
          </div>
        )}

        {tagError && <p className="search-error" role="alert">{tagError}</p>}
        {tagPosts && (
          <div className="search-section">
            <h3>#{tagPosts.tag}</h3>
            {tagPosts.posts.length === 0 ? <p className="search-empty">No posts use that tag yet.</p> : (
              <ul className="search-list">
                {tagPosts.posts.map((post) => (
                  <li key={post.id} className="search-item"><div className="search-item-content"><p>{post.text}</p><span className="search-meta">By {post.username || 'Someone'} · {post.likes} likes</span></div></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && !error && query.length < 2 && (
          <div className="search-prompt">
            <p>Type at least 2 characters to search</p>
            {tags.length > 0 && (
              <div className="search-hashtags">
                {tags.map((tag) => (
                  <button key={tag.tag} type="button" className="search-hashtag" onClick={() => void openTag(tag.tag)}>#{tag.tag}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
