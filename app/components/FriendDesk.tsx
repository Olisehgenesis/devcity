'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

type Incoming = { id: string; username: string; verified: boolean };
type Outgoing = { id: string; username: string };
type Friend = { userId: string; username: string; verified: boolean; locationOn: boolean };

export function FriendDesk({ open }: { open: boolean }) {
  const [username, setUsername] = useState('');
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    void fetch('/api/friends')
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { error?: string; incoming?: Incoming[]; outgoing?: Outgoing[]; friends?: Friend[] };
        if (!response.ok) throw new Error(body.error || 'Could not load friend requests.');
        if (!active) return;
        setIncoming(body.incoming ?? []);
        setOutgoing(body.outgoing ?? []);
        setFriends(body.friends ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load friend requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, reload]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(body.error || 'Could not send that friend request.');
      setUsername('');
      setNotice(body.status === 'accepted' ? 'You are friends.' : 'Friend request sent.');
      setReload((value) => value + 1);
      window.dispatchEvent(new Event('devcity-friends-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send that friend request.');
    } finally {
      setSending(false);
    }
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    setError('');
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(body.error || 'Could not update that friend request.');
      return;
    }
    setReload((value) => value + 1);
    window.dispatchEvent(new Event('devcity-friends-changed'));
  }

  return (
    <section className="friend-desk" aria-label="Friend requests">
      <p className="social-section-label">FRIEND REQUESTS</p>
      <form className="friend-request-form" onSubmit={(event) => void send(event)}>
        <label htmlFor="friend-username">Username</label>
        <div>
          <input
            id="friend-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Their username"
            autoComplete="off"
            aria-label="Friend username"
          />
          <Button type="submit" disabled={sending || username.trim().length < 3}>Send</Button>
        </div>
      </form>
      {loading && <p className="social-empty" role="status">Loading friend requests…</p>}
      {error && <p className="feed-error" role="alert">{error}</p>}
      {notice && <p className="social-empty" role="status">{notice}</p>}
      {!loading && incoming.length === 0 && outgoing.length === 0 && friends.length === 0 && !error && (
        <p className="social-empty">No friend requests yet. Send one with a username.</p>
      )}
      {incoming.map((request) => (
        <article className="people-item" key={request.id}>
          <div className="people-copy">
            <strong>{request.username}{request.verified ? ' · Verified' : ''}</strong>
            <span>Wants to be friends</span>
          </div>
          <Button type="button" onClick={() => void respond(request.id, 'accept')}>Accept</Button>
          <Button type="button" variant="outline" onClick={() => void respond(request.id, 'decline')}>Decline</Button>
        </article>
      ))}
      {outgoing.map((request) => (
        <article className="people-item" key={request.id}>
          <div className="people-copy"><strong>{request.username}</strong><span>Request sent</span></div>
        </article>
      ))}
      {friends.length > 0 && <p className="social-section-label">FRIENDS <span>{friends.length}</span></p>}
      {friends.map((friend) => (
        <article className="people-item" key={friend.userId}>
          <div className="people-copy">
            <strong>{friend.username}{friend.verified ? ' · Verified' : ''}</strong>
            <span>{friend.locationOn ? 'Location on' : 'Location off'}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
