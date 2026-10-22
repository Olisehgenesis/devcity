'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Heart, MapPin, MessageCircle, Paperclip, Radio, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLoader } from './BrandLoader';
import { Sheet } from './Sheet';
import { timeAgo } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';
import { FriendDesk } from './FriendDesk';
import { UnlockSecret } from './PinBoxes';
import { ChatList } from './chat/ChatList';
import { useXmtpChat, type XmtpUiMessage } from '../hooks/useXmtpChat';
import { resolveIdentity, shortAddress } from '../lib/resolve-identity';
import { useChatRead } from '../lib/chat-read';
import type { Attachment } from '@xmtp/browser-sdk';
import type { Hex } from 'viem';
import type { LocalWallet } from '@/lib/keystore';
import { getUnlockedPrivateKey, getUnlockedWallet, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { useUnlockedKey } from '../hooks/useUnlockedKey';
import { formatDistance } from '@/lib/geo';
import { friendlyError } from '@/lib/friendly-error';
import { MediaPicker } from './MediaPicker';

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

type FeedReaction = { emoji: string; userId: string };
type FeedBroadcast = {
  id: string;
  text: string;
  mediaUrl?: string | null;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  liked: boolean;
  comments: FeedComment[];
  reactions?: FeedReaction[];
};

const REACTIONS = ['🔥', '👀', '💜'];

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function awayLabel(km: number) {
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';
  return `${formatDistance(km * 1000)} away`;
}

function PostText({ text, onTag }: { text: string; onTag?: (tag: string) => void }) {
  const parts = text.split(/(#[a-z0-9_]+)/gi);
  return (
    <p className="broadcast-copy">
      {parts.map((part, index) => part.startsWith('#') ? (
        <button key={`${part}-${index}`} type="button" className="post-tag" onClick={() => onTag?.(part.slice(1))}>{part}</button>
      ) : <span key={`${part}-${index}`}>{part}</span>)}
    </p>
  );
}

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
  onStartChatHandled?: () => void;
  onOpenHashtag?: (tag: string) => void;
  onStoriesChanged?: () => void;
}

type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
  distance: number;
};

type FriendProfile = {
  username: string;
  displayName: string | null;
  avatar: string | null;
  address: string | null;
  joinedAt: string | null;
  viewerFollows: boolean;
  following: Array<{ username: string | null; displayName: string | null; avatar: string | null; address: string | null }>;
  posts: Array<{ id: string; text: string; createdAt: string }>;
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

export function CitySocialSheet({ open, view, avatarSrc, profileStatus, userAddress, onRequestProfile, onNotify, onConnectWallet, onEnableNotifications, notificationsEnabled, onClose, onTip, startChatAddress, onStartChatHandled, onOpenHashtag, onStoriesChanged }: CitySocialSheetProps) {
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
  const [broadcastMedia, setBroadcastMedia] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');
  const [chatQuery, setChatQuery] = useState('');
  const [chatPane, setChatPane] = useState<'chats' | 'friends'>('chats');
  const [chatNames, setChatNames] = useState<Record<string, string>>({});
  const [selectedFriend, setSelectedFriend] = useState<PresenceUser | null>(null);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [friendProfileError, setFriendProfileError] = useState('');
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);
  const [friendsReload, setFriendsReload] = useState(0);
  const [chatActionError, setChatActionError] = useState('');
  const [inboxWallet, setInboxWallet] = useState<LocalWallet | null>(null);
  const [inboxWalletLoading, setInboxWalletLoading] = useState(false);
  const [inboxWalletError, setInboxWalletError] = useState('');
  const [inboxPin, setInboxPin] = useState('');
  const [inboxWalletRetry, setInboxWalletRetry] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const sessionKey = useUnlockedKey(userAddress);
  const xmtp = useXmtpChat(open && view === 'chat', onNotify);
  const connectWithLocalWallet = xmtp.connectWithLocalWallet;
  const startXmtpConversation = xmtp.startConversation;
  const resolveInbox = xmtp.resolveInbox;
  const xmtpStatus = xmtp.status;
  const markRead = useChatRead((state) => state.markRead);
  const hideChat = useChatRead((state) => state.hide);
  const muteChat = useChatRead((state) => state.mute);
  const hiddenChats = useChatRead((state) => state.hidden);
  const mutedChats = useChatRead((state) => state.muted);
  const lastReadAt = useChatRead((state) => state.lastReadAt);

  useEffect(() => {
    if (!startChatAddress) return;
    setRecipient(startChatAddress);
    if (xmtpStatus !== 'ready') return;
    let cancelled = false;
    void startXmtpConversation(startChatAddress)
      .catch((cause: unknown) => {
        if (!cancelled) setChatActionError(cause instanceof Error ? cause.message : 'Could not start this chat.');
      })
      .finally(() => {
        if (!cancelled) onStartChatHandled?.();
      });
    return () => { cancelled = true; };
  }, [onStartChatHandled, startChatAddress, startXmtpConversation, xmtpStatus]);

  useEffect(() => {
    if (!open || view !== 'chat') {
      setInboxPin('');
      return;
    }
    if (profileStatus !== 'ready' || !userAddress) {
      setInboxPin('');
      return;
    }
    let cancelled = false;
    setInboxWallet(null);
    setInboxWalletError('');
    setInboxWalletLoading(true);
    void import('@/lib/keystore')
      .then(({ listLocalWallets }) => listLocalWallets())
      .then((wallets) => {
        if (cancelled) return;
        const wallet = wallets.find((item) => item.address.toLowerCase() === userAddress.toLowerCase());
        if (!wallet) throw new Error('This device does not have the wallet for your passkey account.');
        setInboxWallet(wallet);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInboxWalletError(error instanceof Error ? error.message : 'Could not load your wallet.');
      })
      .finally(() => {
        if (!cancelled) setInboxWalletLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, profileStatus, userAddress, view, inboxWalletRetry]);

  useEffect(() => {
    if (!open || view !== 'chat' || xmtpStatus !== 'idle') return;
    const unlocked = userAddress ? null : getUnlockedWallet();
    const key = userAddress ? getUnlockedPrivateKey(userAddress) : unlocked?.privateKey;
    const address = userAddress ?? unlocked?.address;
    if (!key || !address) return;
    void connectWithLocalWallet(key, address);
  }, [open, view, xmtpStatus, sessionKey, userAddress, connectWithLocalWallet]);

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
  }, [open, view, userAddress, friendsReload]);

  useEffect(() => {
    if (!selectedFriend) {
      setFriendProfile(null);
      setFriendProfileError('');
      return;
    }
    const controller = new AbortController();
    setFriendProfileLoading(true);
    setFriendProfileError('');
    void fetch(`/api/users/${encodeURIComponent(selectedFriend.username)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as FriendProfile & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not open this profile.');
        setFriendProfile(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFriendProfileError(error instanceof Error ? error.message : 'Could not open this profile.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setFriendProfileLoading(false);
      });
    return () => controller.abort();
  }, [selectedFriend]);

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
  const visibleThreads = xmtp.threads.filter((item) => !hiddenChats[item.id]);
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of visibleThreads) {
      const sentAt = item.lastMessage?.sentAt.getTime() ?? 0;
      if (item.lastMessage && !item.lastMessage.mine && sentAt > (lastReadAt[item.id] ?? 0)) counts[item.id] = 1;
    }
    return counts;
  }, [lastReadAt, visibleThreads]);
  const threadKey = visibleThreads.map((item) => `${item.id}:${item.peerAddress ?? ''}:${item.peerInboxId}`).join('|');
  const visibleThreadsRef = useRef(visibleThreads);
  visibleThreadsRef.current = visibleThreads;

  useEffect(() => {
    if (xmtp.activeThreadId) markRead(xmtp.activeThreadId);
  }, [markRead, xmtp.activeThreadId]);

  useEffect(() => {
    if (xmtpStatus !== 'ready' || !threadKey) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const item of visibleThreadsRef.current) {
        const address = item.peerAddress ?? await resolveInbox(item.peerInboxId);
        if (!address) continue;
        try {
          const identity = await resolveIdentity(address);
          next[item.id] = identity.displayName || identity.username || shortAddress(address);
        } catch {
          next[item.id] = shortAddress(address);
        }
      }
      if (!cancelled) setChatNames((current) => ({ ...current, ...next }));
    })();
    return () => { cancelled = true; };
  }, [resolveInbox, threadKey, xmtpStatus]);
  const title = view === 'feed' ? 'Around the city' : view === 'people' ? 'People nearby' : thread ? shortInbox(thread.peerInboxId) : 'Your chats';
  const signedIn = profileStatus === 'ready' || profileStatus === 'wallet-needed';

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      setChatActionError('');
      const body = draft;
      setDraft('');
      await xmtp.sendText(body);
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

  async function connectPasskeyInbox(pin = inboxPin) {
    if (!inboxWallet) return;
    let privateKey = getUnlockedPrivateKey(inboxWallet.address);
    if (!privateKey && inboxWallet.pinProtected && !/^\d{6}$/.test(pin)) {
      setChatActionError('Enter your 6-digit wallet PIN to unlock the inbox.');
      return;
    }
    if (!privateKey && !inboxWallet.pinProtected && !pin) {
      setChatActionError('Enter your wallet passphrase to unlock the inbox.');
      return;
    }
    setChatActionError('');
    try {
      if (!privateKey) {
        const { decryptWithPassphrase } = await import('@/lib/keystore');
        const key = await decryptWithPassphrase(pin, inboxWallet.encryptedPrivateKey);
        if (!/^0x[a-fA-F0-9]{64}$/.test(key)) throw new Error('The unlocked wallet key is invalid.');
        privateKey = key as Hex;
        rememberUnlockedWallet(inboxWallet.address, privateKey);
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
        body: JSON.stringify({ userAddress, text: broadcastDraft, mediaUrl: broadcastMedia }),
      });
      const data = await response.json() as { broadcast?: FeedBroadcast; error?: string };
      if (!response.ok || !data.broadcast) throw new Error(data.error || 'Broadcast could not be saved.');
      setBroadcasts((items) => [data.broadcast!, ...items.filter((item) => item.id !== data.broadcast!.id)]);
      setBroadcastDraft('');
      setBroadcastMedia(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Broadcast could not be saved.');
    } finally {
      setBroadcastSaving(false);
    }
  }

  async function shareStory() {
    const content = broadcastDraft.trim();
    if (!content && !broadcastMedia) return;
    if (profileStatus !== 'ready' || !userAddress) {
      onRequestProfile();
      return;
    }
    setBroadcastSaving(true);
    setFeedError('');
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, content: content || 'A moment in the city', mediaUrl: broadcastMedia }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Story could not be posted.');
      setBroadcastDraft('');
      setBroadcastMedia(null);
      onStoriesChanged?.();
      onNotify('Story posted for the city.');
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Story could not be posted.');
    } finally {
      setBroadcastSaving(false);
    }
  }

  async function toggleReaction(broadcastId: string, emoji: string) {
    if (profileStatus !== 'ready' || !userAddress) {
      onRequestProfile();
      return;
    }
    setPendingBroadcastId(broadcastId);
    try {
      const response = await fetch(`/api/broadcasts/${encodeURIComponent(broadcastId)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, emoji }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Reaction could not be saved.');
      setFeedRetry((count) => count + 1);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Reaction could not be saved.');
    } finally {
      setPendingBroadcastId(null);
    }
  }

  async function saveEdit(broadcastId: string) {
    const text = editDraft.trim();
    if (!text || !userAddress) return;
    setPendingBroadcastId(broadcastId);
    setFeedError('');
    try {
      const response = await fetch(`/api/broadcasts/${encodeURIComponent(broadcastId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, text }),
      });
      const data = await response.json() as { error?: string; broadcast?: { text: string; updatedAt?: string } };
      if (!response.ok) throw new Error(data.error || 'Post could not be edited.');
      setBroadcasts((items) => items.map((item) => item.id === broadcastId ? { ...item, text, updatedAt: data.broadcast?.updatedAt } : item));
      setEditingId(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Post could not be edited.');
    } finally {
      setPendingBroadcastId(null);
    }
  }

  async function deletePost(broadcastId: string) {
    if (!userAddress) return;
    setPendingBroadcastId(broadcastId);
    setFeedError('');
    try {
      const response = await fetch(`/api/broadcasts/${encodeURIComponent(broadcastId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Post could not be deleted.');
      setBroadcasts((items) => items.filter((item) => item.id !== broadcastId));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Post could not be deleted.');
    } finally {
      setPendingBroadcastId(null);
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
    <Sheet open={open && view !== null} onClose={onClose} title={title} size="page" keepNav>
      {view === 'feed' && (
        <div className="social-feed">
          <div className="social-live-line"><span className="live-dot" /> City feed</div>
          {profileStatus === 'ready' ? (
            <form className="broadcast-composer" onSubmit={sendBroadcast}>
              <span className="broadcast-composer-avatar">{avatarSrc ? <img src={avatarSrc} alt="" /> : 'Y'}</span>
              <textarea value={broadcastDraft} onChange={(event) => setBroadcastDraft(event.target.value.slice(0, 240))} placeholder="What's happening around you?" rows={2} aria-label="Write a city broadcast" />
              <MediaPicker selectedMedia={broadcastMedia} onMediaSelect={(url) => setBroadcastMedia(url)} onRemove={() => setBroadcastMedia(null)} />
              <div className="broadcast-composer-bottom"><small>{broadcastDraft.length}/240 · saved to the city feed</small><Button type="button" variant="outline" disabled={broadcastSaving || (!broadcastDraft.trim() && !broadcastMedia)} onClick={() => void shareStory()}>Story</Button><Button type="submit" disabled={!broadcastDraft.trim() || broadcastSaving}><RadioIcon /> {broadcastSaving ? 'Saving…' : 'Broadcast'}</Button></div>
            </form>
          ) : (
            <div className="feed-profile-gate">
              <strong>{profileStatus === 'checking' ? 'Checking your profile…' : profileStatus === 'wallet-needed' ? 'Your account is signed in' : profileStatus === 'error' ? 'Profile check failed' : 'Sign in to join the conversation'}</strong>
              <p>{profileStatus === 'checking' ? 'Your account is needed to post, like, or comment.' : profileStatus === 'wallet-needed' ? 'A wallet on this device is needed before you can post.' : profileStatus === 'error' ? 'Open your profile to retry.' : 'Use the same sign-in as your profile.'}</p>
              {profileStatus === 'wallet-needed' && <Button type="button" onClick={onConnectWallet}>Set up wallet</Button>}
              {profileStatus !== 'checking' && profileStatus !== 'wallet-needed' && <Button type="button" onClick={onRequestProfile}>Open your profile</Button>}
            </div>
          )}
          {feedError && <p className="feed-error" role="alert">{feedError}{broadcasts.length === 0 && <Button type="button" variant="outline" onClick={() => setFeedRetry((count) => count + 1)}>Try again</Button>}</p>}
          {feedLoading && broadcasts.length === 0 && <p className="social-empty" role="status">Loading the city feed…</p>}
          {broadcasts.map((broadcast) => {
            const isOwn = !!userAddress && broadcast.userId === `user_${userAddress.toLowerCase()}`;
            const author = isOwn ? 'You' : broadcast.username && !broadcast.username.startsWith('user_') ? broadcast.username : 'Someone';
            const authorAvatar = broadcast.avatarUrl || (isOwn ? avatarSrc : undefined);
            return (
            <article className="broadcast-card" key={broadcast.id}>
              <header><span className="broadcast-composer-avatar">{authorAvatar ? <img src={authorAvatar} alt="" /> : author.slice(0, 1).toUpperCase()}</span><span><strong>{author}</strong><small>{timeAgo(Date.parse(broadcast.createdAt))}</small></span><span className="broadcast-pulse" title="Shared with the city" /></header>
              {editingId === broadcast.id ? (
                <form className="broadcast-comment-form" onSubmit={(event) => { event.preventDefault(); void saveEdit(broadcast.id); }}>
                  <input value={editDraft} onChange={(event) => setEditDraft(event.target.value.slice(0, 240))} aria-label="Edit post" />
                  <button type="submit" disabled={!editDraft.trim()} aria-label="Save edit">Save</button>
                </form>
              ) : <PostText text={broadcast.text} onTag={onOpenHashtag} />}
              {broadcast.mediaUrl && <img className="broadcast-media" src={broadcast.mediaUrl} alt="" />}
              {broadcast.updatedAt && broadcast.updatedAt !== broadcast.createdAt && <small className="chat-demo-note">Edited</small>}
              <div className="broadcast-actions">
                <button className={broadcast.liked ? 'is-liked' : ''} onClick={() => void toggleLike(broadcast.id)} disabled={pendingBroadcastId === broadcast.id} aria-label={broadcast.liked ? 'Unlike broadcast' : 'Like broadcast'}><Heart size={15} fill={broadcast.liked ? 'currentColor' : 'none'} /> {broadcast.likes}</button>
                <button onClick={() => setCommentingId(commentingId === broadcast.id ? null : broadcast.id)}><MessageCircle size={15} /> {countLabel(broadcast.comments.length, 'comment', 'comments')}</button>
                {REACTIONS.map((emoji) => {
                  const count = (broadcast.reactions ?? []).filter((reaction) => reaction.emoji === emoji).length;
                  const mine = (broadcast.reactions ?? []).some((reaction) => reaction.emoji === emoji && reaction.userId === `user_${userAddress?.toLowerCase()}`);
                  return <button key={emoji} type="button" className={mine ? 'is-liked' : ''} onClick={() => void toggleReaction(broadcast.id, emoji)} aria-label={`React ${emoji}`}>{emoji} {count || ''}</button>;
                })}
                {isOwn && <button type="button" onClick={() => { setEditingId(broadcast.id); setEditDraft(broadcast.text); }}>Edit</button>}
                {isOwn && <button type="button" onClick={() => void deletePost(broadcast.id)}>Delete</button>}
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
          <Button type="button" variant="outline" onClick={onClose}><MapPin size={15} /> Back to the map</Button>
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
                <div className="people-copy"><strong>{person.username}</strong><span>{person.status}</span><small><MapPin size={11} /> {awayLabel(person.distance)}</small></div>
                <Button type="button" onClick={() => void toggleFollow(person)} aria-label={`${following.has(person.userId) ? 'Unfollow' : 'Follow'} ${person.username}`} title={`${following.has(person.userId) ? 'Unfollow' : 'Follow'} ${person.username}`}>
                  {following.has(person.userId) ? 'Following' : '+ Follow'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => {
                    const address = person.userId.replace(/^user_/, '');
                    onTip(person.username, initialsFor(person.username), tone, /^0x[a-fA-F0-9]{40}$/.test(address) ? address : undefined);
                  }}
                  aria-label={`Tip ${person.username}`}
                  title={`Tip ${person.username}`}
                ><Heart size={17} /></Button>
              </article>
            );
          })}
          {filteredPeople.length === 0 && <p className="social-empty">No one by that name is in this part of the city yet.</p>}
        </div>
      )}

      {view === 'chat' && (
        <div className="social-chat">
          {!thread && (
            <div className="chat-pane-switch" role="tablist" aria-label="Inbox">
              <button type="button" role="tab" aria-selected={chatPane === 'chats'} onClick={() => setChatPane('chats')}>Chats</button>
              <button type="button" role="tab" aria-selected={chatPane === 'friends'} onClick={() => setChatPane('friends')}>Friends</button>
            </div>
          )}
          {chatPane === 'friends' && !thread && selectedFriend ? (
            <FriendProfileView
              friend={selectedFriend}
              profile={friendProfile}
              loading={friendProfileLoading}
              error={friendProfileError}
              onBack={() => setSelectedFriend(null)}
              onUnfollow={async () => {
                const address = selectedFriend.userId.replace(/^user_/, '');
                if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
                const response = await fetch(`/api/follows?followingAddress=${encodeURIComponent(address)}`, { method: 'DELETE' });
                const data = await response.json().catch(() => ({})) as { error?: string };
                if (!response.ok) {
                  setFriendProfileError(data.error || 'Could not unfollow.');
                  return;
                }
                setSelectedFriend(null);
                setFriendsReload((count) => count + 1);
              }}
            />
          ) : chatPane === 'friends' && !thread ? (
            <>
              <FriendDesk open={open} />
              <div className="inbox-friends">
                <p className="social-section-label">PEOPLE YOU FOLLOW <span>{friends.length}</span></p>
                {friendsLoading && <p className="social-empty" role="status">Loading your friends…</p>}
                {friendsError && <p className="feed-error" role="alert">{friendsError}</p>}
                {!friendsLoading && !friendsError && friends.length === 0 && <p className="social-empty">No one followed yet. Follow people from the map or People tab to message them here.</p>}
                {friends.map((friend) => (
                  <article className="people-item" key={friend.userId}>
                    <button type="button" className="thread-open" onClick={() => setSelectedFriend(friend)}>
                      <span className={`people-avatar tone-${toneForUsername(friend.username)}`}><img src={friend.avatarUrl ?? dicebearAvatarUrl(friend.username, avatarBackgroundForColor(toneForUsername(friend.username)))} alt="" /><i className={friend.status === 'online' ? 'is-online' : ''} /></span>
                      <span className="people-copy"><strong>{friend.username}</strong><span>{friend.status === 'online' ? 'Online now' : 'Offline'}</span></span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => {
                        const address = friend.userId.replace(/^user_/, '');
                        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
                        setChatPane('chats');
                        setRecipient(address);
                        void xmtp.startConversation(address).catch((error: unknown) => setChatActionError(error instanceof Error ? error.message : 'Could not start this chat.'));
                      }}
                      aria-label={`Message ${friend.username}`}
                      title={`Message ${friend.username}`}
                    ><MessageCircle size={17} /></Button>
                  </article>
                ))}
              </div>
            </>
          ) : xmtp.status === 'error' ? (
            <div className="xmtp-state">
              <strong>Messages didn&apos;t sign in</strong>
              <p>{friendlyError(xmtp.error, 'The inbox could not connect. Try again in a moment.')}</p>
              <Button type="button" onClick={() => { setChatActionError(''); xmtp.resetStatus(); }}>Try again</Button>
            </div>
          ) : xmtp.status === 'connecting' ? (
            <div className="xmtp-state"><BrandLoader /><strong>Signing you into messages</strong><p>Your DEVCITY wallet signs this on this device. This usually takes a few seconds.</p></div>
          ) : xmtp.status !== 'ready' ? (
            <InboxSignIn
              loading={inboxWalletLoading || profileStatus === 'checking'}
              wallet={inboxWallet}
              pin={inboxPin}
              error={chatActionError || xmtp.error || inboxWalletError}
              signedIn={signedIn}
              onPin={(next) => {
                setInboxPin(next);
                if (inboxWallet?.pinProtected && /^\d{6}$/.test(next)) void connectPasskeyInbox(next);
              }}
              onSubmit={() => void connectPasskeyInbox()}
              onRetryWallet={() => setInboxWalletRetry((attempt) => attempt + 1)}
              onSignIn={onRequestProfile}
              onCreateWallet={onConnectWallet}
            />
          ) : thread ? (
            <>
              <Button type="button" variant="outline" onClick={() => { xmtp.setActiveThreadId(null); setDraft(''); }}><ArrowLeft size={15} /> All chats</Button>
              <div className="chat-thread-intro"><span className="people-avatar"><MessageCircle size={17} /></span><strong>{chatNames[thread.id] ?? shortInbox(thread.peerInboxId)}</strong><small>End-to-end encrypted with XMTP</small></div>
              {!notificationsEnabled && <Button type="button" variant="outline" onClick={onEnableNotifications}>Enable message notifications</Button>}
              <div className="chat-messages">
                {xmtp.messages.map((message) => <XmtpMessageView key={message.id} message={message} onRetry={() => void xmtp.retryMessage(message.id)} />)}
                {xmtp.messages.length === 0 && <p className="chat-demo-note">This encrypted conversation is ready. Send the first message.</p>}
              </div>
              <form className="chat-composer" onSubmit={sendMessage}>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={xmtp.sending} aria-label="Attach a file" title="Attach file"><Paperclip size={16} /></button>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write an encrypted message" aria-label="Message" />
                <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={16} /></button>
              </form>
              <input ref={fileInput} type="file" className="avatar-file-input" onChange={sendFile} aria-label="Choose an encrypted attachment" />
              <p className="chat-demo-note">Photos are compressed, then sent encrypted.</p>
              {chatActionError && <p className="xmtp-error" role="alert">{chatActionError}</p>}
            </>
          ) : (
            <>
              {!notificationsEnabled && <Button type="button" variant="outline" onClick={onEnableNotifications}>Enable message notifications</Button>}
              <ChatList
                threads={visibleThreads}
                names={chatNames}
                unread={unreadCounts}
                muted={mutedChats}
                query={chatQuery}
                recipient={recipient}
                onQuery={setChatQuery}
                onRecipient={setRecipient}
                onOpen={(threadId) => xmtp.setActiveThreadId(threadId)}
                onStart={startConversation}
                onHide={hideChat}
                onMute={muteChat}
              />
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

function messageClock(sentAt: Date) {
  return sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function XmtpMessageView({ message, onRetry }: { message: XmtpUiMessage; onRetry: () => void }) {
  const stamp = messageClock(message.sentAt);
  const state = message.delivery === 'sending' ? 'Sending' : message.delivery === 'failed' ? 'Failed. Tap to retry' : stamp;
  if (message.attachment) return <XmtpAttachmentView attachment={message.attachment} mine={message.mine} />;
  return (
    <div className={`chat-bubble-wrap ${message.mine ? 'is-mine' : ''}`}>
      {message.delivery === 'failed' ? (
        <button type="button" className={`chat-bubble ${message.mine ? 'chat-outgoing' : 'chat-incoming'}`} onClick={onRetry}>{message.text}</button>
      ) : (
        <p className={`chat-bubble ${message.mine ? 'chat-outgoing' : 'chat-incoming'}`}>{message.text}</p>
      )}
      <small className="chat-bubble-time">{state}</small>
    </div>
  );
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

function InboxSignIn({
  loading,
  wallet,
  pin,
  error,
  signedIn,
  onPin,
  onSubmit,
  onRetryWallet,
  onSignIn,
  onCreateWallet,
}: {
  loading: boolean;
  wallet: LocalWallet | null;
  pin: string;
  error: string;
  signedIn: boolean;
  onPin: (next: string) => void;
  onSubmit: () => void;
  onRetryWallet: () => void;
  onSignIn: () => void;
  onCreateWallet: () => void;
}) {
  if (loading) return <div className="xmtp-state"><BrandLoader /><strong>Opening your inbox</strong><p>Checking the wallet on this device.</p></div>;
  if (!signedIn) {
    return (
      <div className="xmtp-state">
        <strong>Sign in to open your inbox</strong>
        <p>Messages use the wallet on this account. Sign in and it signs you in here.</p>
        <Button type="button" onClick={onSignIn}>Sign in</Button>
      </div>
    );
  }
  if (!wallet) {
    return (
      <div className="xmtp-state">
        <strong>This device needs your wallet</strong>
        <p>{error || 'Create or restore the wallet for this account. After that, the inbox signs itself.'}</p>
        {error && <Button type="button" variant="outline" onClick={onRetryWallet}>Try again</Button>}
        <Button type="button" onClick={onCreateWallet}>Set up wallet</Button>
      </div>
    );
  }
  return (
    <form className="xmtp-state" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <strong>Sign in to messages</strong>
      <p>Your wallet signs this here. Enter the PIN once for this visit.</p>
      <UnlockSecret id="inbox-pin" pinProtected={wallet.pinProtected} value={pin} onChange={onPin} />
      {!wallet.pinProtected && <Button type="submit">Open inbox</Button>}
      {error && <p className="xmtp-error" role="alert">{error}</p>}
    </form>
  );
}

function FriendProfileView({
  friend,
  profile,
  loading,
  error,
  onBack,
  onUnfollow,
}: {
  friend: PresenceUser;
  profile: FriendProfile | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onUnfollow: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const name = profile?.displayName || friend.username;
  return (
    <div className="friend-profile">
      <Button type="button" variant="outline" onClick={onBack}><ArrowLeft size={15} /> Friends</Button>
      <div className="chat-thread-intro">
        <span className={`people-avatar tone-${toneForUsername(friend.username)}`}>
          <img src={profile?.avatar || friend.avatarUrl || dicebearAvatarUrl(friend.username, avatarBackgroundForColor(toneForUsername(friend.username)))} alt="" />
        </span>
        <strong>{name}</strong>
        <small>{profile?.address ? shortAddress(profile.address) : friend.username}</small>
      </div>
      {profile?.viewerFollows && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setBusy(true); void onUnfollow().finally(() => setBusy(false)); }}>
          {busy ? 'Unfollowing…' : 'Unfollow'}
        </Button>
      )}
      {loading && <p className="social-empty" role="status">Loading their page…</p>}
      {error && <p className="xmtp-error" role="alert">{error}</p>}
      {profile && (
        <>
          <p className="social-section-label">FOLLOWS <span>{profile.following.length}</span></p>
          {profile.following.length === 0 && <p className="social-empty">They are not following anyone yet.</p>}
          {profile.following.map((person) => (
            <article className="people-item" key={person.address ?? person.username ?? person.displayName}>
              <span className="people-copy"><strong>{person.displayName || person.username || 'Someone'}</strong><span>{person.username ?? ''}</span></span>
            </article>
          ))}
          <p className="social-section-label">POSTS <span>{profile.posts.length}</span></p>
          {profile.posts.length === 0 && <p className="social-empty">No posts yet.</p>}
          {profile.posts.map((post) => (
            <article className="people-item" key={post.id}>
              <span className="people-copy"><strong>{post.text}</strong><span>{timeAgo(Date.parse(post.createdAt))}</span></span>
            </article>
          ))}
        </>
      )}
    </div>
  );
}