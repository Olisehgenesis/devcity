'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Heart, KeyRound, MapPin, MessageCircle, Paperclip, Radio, Search, Send } from 'lucide-react';
import { Sheet } from './Sheet';
import { timeAgo } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';
import { FriendDesk } from './FriendDesk';
import { useXmtpChat, type XmtpUiMessage } from '../hooks/useXmtpChat';
import type { Attachment } from '@xmtp/browser-sdk';
import type { Hex } from 'viem';
import type { LocalWallet } from '@/lib/keystore';
import { getUnlockedPrivateKey, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { useUnlockedKey } from '../hooks/useUnlockedKey';

export type SocialView = 'feed' | 'chat' | 'people';
export type FeedProfileStatus = 'checking' | 'signed-out' | 'wallet-needed' | 'ready' | 'error';

type FeedComment = {
  id: string;
  text: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type FeedBroadcast = {
  id: string;
  text: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  likes: number;
  liked: boolean;
  comments: FeedComment[];
};

interface CitySocialSheetProps {
  open: boolean;
  view: SocialView | null;
  avatarSrc?: string;
  profileStatus: FeedProfileStatus;
  userAddress: string | null;
  onRequestProfile: () => void;
  onNotify: (message: string) => void;
  onConnectWallet: () => void;
  onEnableNotifications: () => void;
  notificationsEnabled: boolean;
  onClose: () => void;
  onTip: (name: string, initials: string, color: string, address?: string) => void;
  startChatAddress?: string | null;
}

type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
  distance: number;
};

const TONES = ['coral', 'yellow', 'blue', 'pink', 'mint', 'lime', 'orange'];

function toneForUsername(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

function initialsFor(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || username.slice(0, 2).toUpperCase();
}

export function CitySocialSheet({ open, view, avatarSrc, profileStatus, userAddress, onRequestProfile, onNotify, onConnectWallet, onEnableNotifications, notificationsEnabled, onClose, onTip, startChatAddress }: CitySocialSheetProps) {
  const [query, setQuery] = useState('');
  const [nearbyPeople, setNearbyPeople] = useState<PresenceUser[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<PresenceUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [feedRetry, setFeedRetry] = useState(0);
  const [broadcastSaving, setBroadcastSaving] = useState(false);
  const [pendingBroadcastId, setPendingBroadcastId] = useState<string | null>(null);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');
  const [chatActionError, setChatActionError] = useState('');
  const [inboxWallet, setInboxWallet] = useState<LocalWallet | null>(null);
  const [inboxWalletLoading, setInboxWalletLoading] = useState(false);
  const [inboxWalletError, setInboxWalletError] = useState('');
  const [inboxWalletUnlocked, setInboxWalletUnlocked] = useState(false);
  const [inboxPin, setInboxPin] = useState('');
  const [inboxWalletRetry, setInboxWalletRetry] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const sessionKey = useUnlockedKey(userAddress);
  const xmtp = useXmtpChat(open && view === 'chat', onNotify);
  const connectWithLocalWallet = xmtp.connectWithLocalWallet;

  useEffect(() => {
    if (startChatAddress) {
      setRecipient(startChatAddress);
      xmtp.setActiveThreadId(null);
    }
  }, [startChatAddress, xmtp]);

  useEffect(() => {
    if (!open || view !== 'chat' || profileStatus !== 'ready' || !userAddress) {
      setInboxPin('');
      return;
    }
    let cancelled = false;
    setInboxWallet(null);
    setInboxWalletError('');
    setInboxWalletUnlocked(false);
    setInboxWalletLoading(true);
    void import('@/lib/keystore')
      .then(({ listLocalWallets }) => listLocalWallets())
      .then((wallets) => {
        if (cancelled) return;
        const wallet = wallets.find((item) => item.address.toLowerCase() === userAddress.toLowerCase());
        if (!wallet) throw new Error('This device does not have the wallet for your passkey account.');
        setInboxWallet(wallet);
        const privateKey = getUnlockedPrivateKey(wallet.address);
        if (privateKey) {
          setInboxWalletUnlocked(true);
          void connectWithLocalWallet(privateKey, wallet.address);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInboxWalletError(error instanceof Error ? error.message : 'Could not load your wallet.');
      })
      .finally(() => {
        if (!cancelled) setInboxWalletLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, profileStatus, userAddress, view, inboxWalletRetry, connectWithLocalWallet, sessionKey]);

  useEffect(() => {
    if (!open || view !== 'feed') return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (userAddress) params.set('userAddress', userAddress);
    setFeedLoading(true);
    setFeedError('');

    void (async () => {
      try {
        const queryString = params.size ? `?${params.toString()}` : '';
        const response = await fetch(`/api/broadcasts${queryString}`, { signal: controller.signal });
        const data = await response.json() as { broadcasts?: FeedBroadcast[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not load the city feed.');
        setBroadcasts(data.broadcasts ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFeedError(error instanceof Error ? error.message : 'Could not load the city feed.');
      } finally {
        if (!controller.signal.aborted) setFeedLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, view, userAddress, feedRetry]);

  useEffect(() => {
    if (!open || view !== 'people') return;
    let cancelled = false;
    fetch('/api/presence/nearby?lat=19.0662&lng=72.8697&radius=50')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { users?: PresenceUser[] } | null) => {
        if (!cancelled && data?.users) setNearbyPeople(data.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, view]);

  useEffect(() => {
    if (!open || view !== 'chat' || !userAddress) return;
    let cancelled = false;
    setFriendsLoading(true);
    setFriendsError('');
    void (async () => {
      try {
        const [followingResponse, presenceResponse] = await Promise.all([
          fetch(`/api/follows?address=${encodeURIComponent(userAddress)}&type=following`),
          fetch('/api/presence/nearby?lat=19.0662&lng=72.8697&radius=500'),
        ]);
        const followingData = await followingResponse.json() as { following?: Array<{ walletAddress: string; username: string; avatarUrl: string | null; name: string | null }>; error?: string };
        if (!followingResponse.ok) throw new Error(followingData.error || 'Could not load your friends.');
        const presenceData = await presenceResponse.json() as { users?: PresenceUser[] };
        const online = new Set((presenceData.users ?? []).map((user) => user.userId.replace(/^user_/, '').toLowerCase()));
        const rows = (followingData.following ?? []).map((friend) => ({
          userId: `user_${friend.walletAddress.toLowerCase()}`,
          username: friend.username || friend.name || friend.walletAddress.slice(0, 6),
          avatarUrl: friend.avatarUrl,
          status: online.has(friend.walletAddress.toLowerCase()) ? 'online' : 'offline',
          distance: 0,
        }));
        if (!cancelled) setFriends(rows);
      } catch (error) {
        if (!cancelled) setFriendsError(error instanceof Error ? error.message : 'Could not load your friends.');
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, view, userAddress]);

  async function toggleFollow(person: PresenceUser) {
    const self = await import('@/lib/keystore');
    const local = await self.listLocalWallets();
    const myAddress = local[0]?.address;
    if (!myAddress) {
      onNotify('Create a passkey wallet first, then follow people.');
      return;
    }
    const theirAddress = person.userId.startsWith('user_') ? `0x${person.userId.slice(5)}` : person.userId;
    if (following.has(person.userId)) {
      await fetch(`/api/follows?followerAddress=${myAddress}&followingAddress=${theirAddress}`, { method: 'DELETE' }).catch(() => {});
      const next = new Set(following);
      next.delete(person.userId);
      setFollowing(next);
      return;
    }
    await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerAddress: myAddress, followingAddress: theirAddress }),
    }).catch(() => {});
    setFollowing((prev) => new Set(prev).add(person.userId));
  }

  const filteredPeople = useMemo(() => nearbyPeople.filter((person) =>
    `${person.username} ${person.status}`.toLowerCase().includes(query.toLowerCase())), [nearbyPeople, query]);
  const thread = xmtp.threads.find((item) => item.id === xmtp.activeThreadId);
  const title = view === 'feed' ? 'Around the city' : view === 'people' ? 'People nearby' : thread ? shortInbox(thread.peerInboxId) : 'Your chats';
  const signedIn = profileStatus === 'ready' || profileStatus === 'wallet-needed';
  const shouldConnectPasskeyInbox = profileStatus === 'ready'
    && Boolean(userAddress)
    && !sessionKey
    && xmtp.status !== 'connecting'
    && (xmtp.status === 'idle' || xmtp.status === 'error' || xmtp.connectedAddress?.toLowerCase() !== userAddress?.toLowerCase());

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      setChatActionError('');
      await xmtp.sendText(draft);
      setDraft('');
    } catch (error) {
      setChatActionError(error instanceof Error ? error.message : 'Message could not be sent.');
    }
  }

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setChatActionError('');
      const conversation = await xmtp.startConversation(recipient);
      xmtp.setActiveThreadId(conversation.id);
      setRecipient('');
    } catch (error) {
      setChatActionError(error instanceof Error ? error.message : 'Could not start this chat.');
    }
  }

  async function sendFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setChatActionError('');
      await xmtp.sendAttachment(file);
    } catch (error) {
      setChatActionError(error instanceof Error ? error.message : 'Attachment could not be sent.');
    }
  }

  async function connectPasskeyInbox() {
    if (!inboxWallet) return;
    let privateKey = getUnlockedPrivateKey(inboxWallet.address);
    if (!privateKey && inboxWallet.pinProtected && !/^\d{6}$/.test(inboxPin)) {
      setChatActionError('Enter your 6-digit wallet PIN to unlock the inbox.');
      return;
    }
    if (!privateKey && !inboxWallet.pinProtected && !inboxPin) {
      setChatActionError('Enter your wallet passphrase to unlock the inbox.');
      return;
    }
    setChatActionError('');
    try {
      if (!privateKey) {
        const { decryptWithPassphrase } = await import('@/lib/keystore');
        const key = await decryptWithPassphrase(inboxPin, inboxWallet.encryptedPrivateKey);
        if (!/^0x[a-fA-F0-9]{64}$/.test(key)) throw new Error('The unlocked wallet key is invalid.');
        privateKey = key as Hex;
        rememberUnlockedWallet(inboxWallet.address, privateKey);
        setInboxWalletUnlocked(true);
      }
      await connectWithLocalWallet(privateKey, inboxWallet.address);
    } catch (error) {
      setChatActionError(error instanceof DOMException && error.name === 'OperationError'
        ? 'That PIN did not unlock this wallet. Check it and try again.'
        : error instanceof Error
          ? error.message
          : 'Could not unlock this wallet.');
    } finally {
      setInboxPin('');
    }
  }

  async function sendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!broadcastDraft.trim()) return;
    if (profileStatus !== 'ready' || !userAddress) {
      onRequestProfile();
      return;
    }
    setBroadcastSaving(true);
    setFeedError('');
    try {
      const response = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, text: broadcastDraft }),
      });
      const data = await response.json() as { broadcast?: FeedBroadcast; error?: string };
      if (!response.ok || !data.broadcast) throw new Error(data.error || 'Broadcast could not be saved.');
      setBroadcasts((items) => [data.broadcast!, ...items.filter((item) => item.id !== data.broadcast!.id)]);
      setBroadcastDraft('');
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Broadcast could not be saved.');
    } finally {
      setBroadcastSaving(false);
    }
  }

  async function toggleLike(broadcastId: string) {
    if (profileStatus !== 'ready' || !userAddress) {
      onRequestProfile();
      return;
    }
    setPendingBroadcastId(broadcastId);
    setFeedError('');
    try {
      const response = await fetch(`/api/broadcasts/${encodeURIComponent(broadcastId)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress }),
      });
      const data = await response.json() as { broadcast?: FeedBroadcast; error?: string };
      if (!response.ok || !data.broadcast) throw new Error(data.error || 'Like could not be saved.');
      setBroadcasts((items) => items.map((item) => item.id === broadcastId ? data.broadcast! : item));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Like could not be saved.');
    } finally {
      setPendingBroadcastId(null);
    }
  }

  async function sendBroadcastComment(event: FormEvent<HTMLFormElement>, broadcastId: string) {
    event.preventDefault();
    const text = commentDrafts[broadcastId]?.trim();
    if (!text) return;
    if (profileStatus !== 'ready' || !userAddress) {
      onRequestProfile();
      return;
    }
    setPendingBroadcastId(broadcastId);
    setFeedError('');
    try {
      const response = await fetch(`/api/broadcasts/${encodeURIComponent(broadcastId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, text }),
      });
      const data = await response.json() as { broadcast?: FeedBroadcast; error?: string };
      if (!response.ok || !data.broadcast) throw new Error(data.error || 'Comment could not be saved.');
      setBroadcasts((items) => items.map((item) => item.id === broadcastId ? data.broadcast! : item));
      setCommentDrafts((drafts) => ({ ...drafts, [broadcastId]: '' }));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Comment could not be saved.');
    } finally {
      setPendingBroadcastId(null);
    }
  }

  return (
    <Sheet open={open && view !== null} onClose={onClose} eyebrow="DEVCITY" title={title}>
      {view === 'feed' && (
        <div className="social-feed">
          <div className="social-live-line"><span className="live-dot" /> City feed</div>
          {profileStatus === 'ready' ? (
            <form className="broadcast-composer" onSubmit={sendBroadcast}>
              <span className="broadcast-composer-avatar">{avatarSrc ? <img src={avatarSrc} alt="" /> : 'Y'}</span>
              <textarea value={broadcastDraft} onChange={(event) => setBroadcastDraft(event.target.value.slice(0, 240))} placeholder="What's happening around you?" rows={2} aria-label="Write a city broadcast" />
              <div className="broadcast-composer-bottom"><small>{broadcastDraft.length}/240 · saved to the city feed</small><button type="submit" disabled={!broadcastDraft.trim() || broadcastSaving}><RadioIcon /> {broadcastSaving ? 'Saving…' : 'Broadcast'}</button></div>
            </form>
          ) : (
            <div className="feed-profile-gate">
              <strong>{profileStatus === 'checking' ? 'Checking your profile…' : profileStatus === 'wallet-needed' ? 'Your account is signed in' : profileStatus === 'error' ? 'Profile check failed' : 'Sign in to join the conversation'}</strong>
              <p>{profileStatus === 'checking' ? 'Your account is needed to post, like, or comment.' : profileStatus === 'wallet-needed' ? 'A wallet on this device is needed before you can post.' : profileStatus === 'error' ? 'Open your profile to retry.' : 'Use the same sign-in as your profile.'}</p>
              {profileStatus !== 'checking' && profileStatus !== 'wallet-needed' && <button className="you-connect-primary" onClick={onRequestProfile}>Open your profile</button>}
            </div>
          )}
          {feedError && <p className="feed-error" role="alert">{feedError}{broadcasts.length === 0 && <button onClick={() => setFeedRetry((count) => count + 1)}>Try again</button>}</p>}
          {feedLoading && broadcasts.length === 0 && <p className="social-empty" role="status">Loading the city feed…</p>}
          {broadcasts.map((broadcast) => {
            const isOwn = !!userAddress && broadcast.userId === `user_${userAddress.toLowerCase()}`;
            const author = isOwn ? 'You' : broadcast.username && !broadcast.username.startsWith('user_') ? broadcast.username : 'Someone';
            const authorAvatar = broadcast.avatarUrl || (isOwn ? avatarSrc : undefined);
            return (
            <article className="broadcast-card" key={broadcast.id}>
              <header><span className="broadcast-composer-avatar">{authorAvatar ? <img src={authorAvatar} alt="" /> : author.slice(0, 1).toUpperCase()}</span><span><strong>{author}</strong><small>{timeAgo(Date.parse(broadcast.createdAt))}</small></span><span className="broadcast-pulse" title="Shared with the city" /></header>
              <p className="broadcast-copy">{broadcast.text}</p>
              <div className="broadcast-actions">
                <button className={broadcast.liked ? 'is-liked' : ''} onClick={() => void toggleLike(broadcast.id)} disabled={pendingBroadcastId === broadcast.id} aria-label={broadcast.liked ? 'Unlike broadcast' : 'Like broadcast'}><Heart size={15} fill={broadcast.liked ? 'currentColor' : 'none'} /> {broadcast.likes}</button>
                <button onClick={() => setCommentingId(commentingId === broadcast.id ? null : broadcast.id)}><MessageCircle size={15} /> {broadcast.comments.length} comments</button>
                <span className="broadcast-radius">CITY FEED</span>
              </div>
              {broadcast.comments.map((comment) => <p className="broadcast-comment" key={comment.id}><strong>{comment.username && !comment.username.startsWith('user_') ? comment.username : comment.userId === `user_${userAddress?.toLowerCase()}` ? 'You' : 'Someone'}</strong> {comment.text}</p>)}
              {commentingId === broadcast.id && <form className="broadcast-comment-form" onSubmit={(event) => sendBroadcastComment(event, broadcast.id)}>
                <input value={commentDrafts[broadcast.id] ?? ''} onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [broadcast.id]: event.target.value.slice(0, 240) }))} placeholder="Add a comment" aria-label="Add a comment" />
                <button type="submit" disabled={!commentDrafts[broadcast.id]?.trim() || pendingBroadcastId === broadcast.id} aria-label="Post comment"><Send size={14} /></button>
              </form>}
            </article>
          );
          })}
          {!feedLoading && !feedError && broadcasts.length === 0 && (
            <p className="social-empty">No broadcasts yet. Be the first to share what&apos;s happening.</p>
          )}
          <button className="social-map-link" onClick={onClose}><MapPin size={15} /> Back to the map</button>
        </div>
      )}

      {view === 'people' && (
        <div className="social-people">
          <label className="social-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find someone in the city" /></label>
          <p className="social-section-label">IN THE CITY <span>{filteredPeople.length}</span></p>
          {filteredPeople.map((person) => {
            const tone = toneForUsername(person.username);
            return (
              <article className="people-item" key={person.userId}>
                <span className={`people-avatar tone-${tone}`}><img src={person.avatarUrl ?? dicebearAvatarUrl(person.username, avatarBackgroundForColor(tone))} alt={`${person.username}'s avatar`} /><i /></span>
                <div className="people-copy"><strong>{person.username}</strong><span>{person.status}</span><small><MapPin size={11} /> {person.distance} km away</small></div>
                <button className="people-follow" onClick={() => void toggleFollow(person)} aria-label={`${following.has(person.userId) ? 'Unfollow' : 'Follow'} ${person.username}`} title={`${following.has(person.userId) ? 'Unfollow' : 'Follow'} ${person.username}`}>
                  {following.has(person.userId) ? 'Following' : '+ Follow'}
                </button>
                <button
                  className="people-message"
                  onClick={() => {
                    const address = person.userId.replace(/^user_/, '');
                    onTip(person.username, initialsFor(person.username), tone, /^0x[a-fA-F0-9]{40}$/.test(address) ? address : undefined);
                  }}
                  aria-label={`Tip ${person.username}`}
                  title={`Tip ${person.username}`}
                ><Heart size={17} /></button>
              </article>
            );
          })}
          {filteredPeople.length === 0 && <p className="social-empty">No one by that name is in this part of the city yet.</p>}
        </div>
      )}

      {view === 'chat' && (
        <div className="social-chat">
          <FriendDesk open={open} />
          {shouldConnectPasskeyInbox ? (
            <div className="xmtp-state xmtp-passkey-state">
              <span className="xmtp-state-icon"><KeyRound size={21} /></span>
              <strong>Open your encrypted inbox</strong>
              {inboxWalletLoading ? (
                <p>Checking your passkey wallet on this device…</p>
              ) : inboxWallet ? (
                <>
                  {inboxWalletUnlocked ? (
                    <>
                      <p>{inboxWallet.name || 'Your DEVCITY wallet'} is unlocked. Connect to XMTP to load your messages.</p>
                      <button className="xmtp-wallet-connect" onClick={() => void connectPasskeyInbox()}>Retry inbox connection</button>
                    </>
                  ) : (
                    <>
                      <p>Unlock your wallet once. Inbox, claims, and sends share that unlock.</p>
                      <button className="outside-cta" onClick={onConnectWallet}>Open wallet</button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p>{inboxWalletError || 'Your passkey wallet is not available on this device.'}</p>
                  {inboxWalletError && <button className="xmtp-retry" onClick={() => setInboxWalletRetry((attempt) => attempt + 1)}>Try again</button>}
                  {!inboxWalletError && <button className="outside-cta" onClick={onConnectWallet}>Open Wallet</button>}
                </>
              )}
              {(chatActionError || xmtp.error) && <p className="xmtp-error" role="alert">{chatActionError || xmtp.error}</p>}
            </div>
          ) : profileStatus === 'checking' && !xmtp.isWalletConnected ? (
            <div className="xmtp-state"><span className="spinner" /><strong>Checking your passkey account…</strong><p>Your existing DEVCITY wallet will be used if it is available on this device.</p></div>
          ) : !xmtp.isWalletConnected && profileStatus !== 'ready' ? (
            <div className="xmtp-state">
              <span className="xmtp-state-icon"><MessageCircle size={21} /></span>
              <strong>{signedIn ? 'Finish setting up your wallet' : 'Sign in once'}</strong>
              <p>Your encrypted messages are tied to your DEVCITY wallet. Sign in on this device to load your XMTP inbox.</p>
              <button className="outside-cta xmtp-open-wallet" onClick={onConnectWallet}>{profileStatus === 'wallet-needed' ? 'Finish wallet setup' : 'Open Wallet to sign in'}</button>
            </div>
          ) : xmtp.status === 'idle' || xmtp.status === 'error' ? (
            <div className="xmtp-state">
              <span className="xmtp-state-icon"><MessageCircle size={21} /></span>
              <strong>Open your encrypted inbox</strong>
              <p>XMTP uses your connected wallet to create a private messaging identity. Your wallet signs a one-time connection request.</p>
              <button className="outside-cta" onClick={() => void xmtp.connect()}>{xmtp.status === 'error' ? 'Retry XMTP' : 'Enable XMTP chat'}</button>
              {xmtp.error && <p className="xmtp-error" role="alert">{xmtp.error}</p>}
            </div>
          ) : xmtp.status === 'connecting' ? (
            <div className="xmtp-state"><span className="spinner" /><strong>Connecting to XMTP…</strong><p>Syncing your encrypted conversations. Approve any wallet request if prompted.</p></div>
          ) : thread ? (
            <>
              <button className="chat-back" onClick={() => { xmtp.setActiveThreadId(null); setDraft(''); }}><ArrowLeft size={15} /> All chats</button>
              <div className="chat-thread-intro"><span className="people-avatar"><MessageCircle size={17} /></span><strong>{shortInbox(thread.peerInboxId)}</strong><small>End-to-end encrypted with XMTP</small></div>
              {!notificationsEnabled && <button className="xmtp-notification-toggle" onClick={onEnableNotifications}>Enable message notifications</button>}
              <div className="chat-messages">
                {xmtp.messages.map((message) => <XmtpMessageView key={message.id} message={message} />)}
                {xmtp.messages.length === 0 && <p className="chat-demo-note">This encrypted conversation is ready. Send the first message.</p>}
              </div>
              <form className="chat-composer" onSubmit={sendMessage}>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={xmtp.sending} aria-label="Attach a file" title="Attach file"><Paperclip size={16} /></button>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write an encrypted message" aria-label="Message" />
                <button type="submit" disabled={!draft.trim() || xmtp.sending} aria-label="Send message"><Send size={16} /></button>
              </form>
              <input ref={fileInput} type="file" className="avatar-file-input" onChange={sendFile} aria-label="Choose an encrypted attachment" />
              <p className="chat-demo-note">Encrypted inline attachments up to 950 KB.</p>
              {chatActionError && <p className="xmtp-error" role="alert">{chatActionError}</p>}
            </>
          ) : (
            <>
              <div className="social-live-line"><span className="live-dot" /> XMTP · ENCRYPTED INBOX</div>
              {!notificationsEnabled && <button className="xmtp-notification-toggle" onClick={onEnableNotifications}>Enable message notifications</button>}
              <div className="inbox-friends">
                <p className="social-section-label">YOUR FRIENDS <span>{friends.length}</span></p>
                {friendsLoading && <p className="social-empty" role="status">Loading your friends…</p>}
                {friendsError && <p className="feed-error" role="alert">{friendsError}</p>}
                {!friendsLoading && !friendsError && friends.length === 0 && <p className="social-empty">No friends yet. Follow people from the map or People tab to message them here.</p>}
                {friends.map((friend) => (
                  <article className="people-item" key={friend.userId}>
                    <span className={`people-avatar tone-${toneForUsername(friend.username)}`}><img src={friend.avatarUrl ?? dicebearAvatarUrl(friend.username, avatarBackgroundForColor(toneForUsername(friend.username)))} alt={`${friend.username}'s avatar`} /><i className={friend.status === 'online' ? 'is-online' : ''} /></span>
                    <div className="people-copy"><strong>{friend.username}</strong><span>{friend.status === 'online' ? 'Online now' : 'Offline'}</span></div>
                    <button
                      className="people-message"
                      onClick={() => {
                        const address = friend.userId.replace(/^user_/, '');
                        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
                        setRecipient(address);
                        void xmtp.startConversation(address).catch((error: unknown) => setChatActionError(error instanceof Error ? error.message : 'Could not start this chat.'));
                      }}
                      aria-label={`Message ${friend.username}`}
                      title={`Message ${friend.username}`}
                    ><MessageCircle size={17} /></button>
                  </article>
                ))}
              </div>
              <form className="xmtp-new-chat" onSubmit={startConversation}>
                <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Start a chat with 0x wallet address" aria-label="Recipient wallet address" />
                <button type="submit" disabled={!recipient.trim()} aria-label="Start encrypted chat"><MessageCircle size={16} /></button>
              </form>
              {xmtp.threads.map((item) => (
                <button className="thread-item" key={item.id} onClick={() => xmtp.setActiveThreadId(item.id)}>
                  <span className="people-avatar"><MessageCircle size={16} /></span>
                  <span className="thread-copy"><strong>{shortInbox(item.peerInboxId)}</strong><small>{item.lastMessage?.text ?? 'No messages yet'}</small></span>
                  <span className="thread-end"><small>{item.lastMessage ? timeAgo(item.lastMessage.sentAt.getTime()) : ''}</small></span>
                </button>
              ))}
              {xmtp.threads.length === 0 && <p className="social-empty">Your XMTP inbox is empty. Start a chat with someone’s wallet address.</p>}
              {chatActionError && <p className="xmtp-error" role="alert">{chatActionError}</p>}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function RadioIcon() {
  return <Radio size={14} />;
}

function shortInbox(inboxId: string) {
  return inboxId.length > 16 ? `${inboxId.slice(0, 7)}…${inboxId.slice(-5)}` : inboxId;
}

function XmtpMessageView({ message }: { message: XmtpUiMessage }) {
  if (message.attachment) return <XmtpAttachmentView attachment={message.attachment} mine={message.mine} />;
  return <p className={`chat-bubble ${message.mine ? 'chat-outgoing' : 'chat-incoming'}`}>{message.text}</p>;
}

function XmtpAttachmentView({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const bytes = new Uint8Array(attachment.content);
    const objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: attachment.mimeType }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment.content, attachment.mimeType]);

  if (!url) return <p className={`chat-bubble ${mine ? 'chat-outgoing' : 'chat-incoming'}`}>Decrypting attachment…</p>;
  if (attachment.mimeType.startsWith('image/')) return <a className={`chat-attachment ${mine ? 'is-mine' : ''}`} href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.filename ?? 'Encrypted image attachment'} /><small>{attachment.filename ?? 'Image'}</small></a>;
  return <a className={`chat-file-attachment ${mine ? 'is-mine' : ''}`} href={url} download={attachment.filename ?? 'attachment'}><Paperclip size={14} /><span>{attachment.filename ?? 'Download attachment'}</span></a>;
}