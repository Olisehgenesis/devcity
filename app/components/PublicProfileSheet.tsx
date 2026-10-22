'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from './Sheet';
import { dicebearAvatarUrl } from '../lib/avatars';

type PublicProfile = {
  username: string;
  displayName: string;
  avatar: string | null;
  address: string | null;
  joinedAt: string;
  viewerFollows: boolean;
  following: Array<{ username: string | null; displayName: string | null; avatar: string | null; address: string | null }>;
  posts: Array<{ id: string; text: string; createdAt: string }>;
};

export function PublicProfileSheet({
  handle,
  onClose,
  onMessage,
  onTip,
}: {
  handle: string | null;
  onClose: () => void;
  onMessage: (address: string, username: string) => void;
  onTip: (name: string, address?: string) => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [follows, setFollows] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!handle) {
      setProfile(null);
      setMissing(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setMissing(false);
    setError('');
    setProfile(null);
    void fetch(`/api/users/${encodeURIComponent(handle)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as PublicProfile & { error?: string };
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Could not open that profile.');
        setProfile(data);
        setFollows(Boolean(data.viewerFollows));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not open that profile.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [handle]);

  async function toggleFollow() {
    if (!profile?.address) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        follows ? `/api/follows?followingAddress=${encodeURIComponent(profile.address)}` : '/api/follows',
        {
          method: follows ? 'DELETE' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: follows ? undefined : JSON.stringify({ followingAddress: profile.address }),
        },
      );
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update that follow.');
      setFollows(!follows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update that follow.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(handle)} onClose={onClose} eyebrow="City profile" title={profile?.displayName || handle || 'Profile'} size="page">
      {loading && <p className="social-empty" role="status">Opening that profile…</p>}
      {missing && (
        <div className="profile-empty-events">
          <p>No one in the city uses {handle}.</p>
          <span>The link may be old, or the name was typed wrong.</span>
        </div>
      )}
      {error && <p className="feed-error" role="alert">{error}</p>}
      {profile && (
        <div className="you-profile">
          <header className="profile-hero">
            <div className="you-avatar you-avatar-lg">
              <img src={profile.avatar || dicebearAvatarUrl(profile.username)} alt="" />
            </div>
            <div className="you-identity-text">
              <strong className="profile-display-name">{profile.displayName}</strong>
              <span className="profile-account-label">@{profile.username}</span>
            </div>
          </header>
          <div className="card-actions">
            <Button type="button" variant={follows ? 'outline' : 'default'} disabled={busy || !profile.address} onClick={() => void toggleFollow()}>
              {follows ? 'Following' : 'Follow'}
            </Button>
            {profile.address && (
              <Button type="button" variant="outline" onClick={() => onMessage(profile.address!, profile.username)}>Say hello</Button>
            )}
            <Button type="button" variant="outline" onClick={() => onTip(profile.displayName || profile.username, profile.address ?? undefined)}>Tip</Button>
          </div>
          {!profile.address && <p className="you-note">This profile cannot receive a tip until a wallet is linked.</p>}
          <section className="profile-events-section">
            <div className="profile-section-heading">
              <div><span className="profile-section-kicker">POSTS</span><h3>In the feed</h3></div>
              <span className="profile-count">{profile.posts.length}</span>
            </div>
            {profile.posts.length === 0 ? <p className="social-empty">No posts yet.</p> : profile.posts.map((post) => (
              <article className="broadcast-card" key={post.id}>
                <p className="broadcast-copy">{post.text}</p>
              </article>
            ))}
          </section>
          {profile.following.length > 0 && (
            <section>
              <p className="social-section-label">FOLLOWING <span>{profile.following.length}</span></p>
              {profile.following.map((person) => (
                <p className="broadcast-comment" key={person.username ?? person.displayName}><strong>@{person.username || person.displayName}</strong></p>
              ))}
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
