'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Heart, MapPin, MessageCircle, Paperclip, Search, Send, Sparkles } from 'lucide-react';
import { Sheet } from './Sheet';
import { timeAgo, type ActivityItem, type Broadcast } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';
import { useXmtpChat, type XmtpUiMessage } from '../hooks/useXmtpChat';
import type { Attachment } from '@xmtp/browser-sdk';

export type SocialView = 'feed' | 'chat' | 'people';

interface CitySocialSheetProps {
  open: boolean;
  view: SocialView | null;
  activity: ActivityItem[];
  broadcasts: Broadcast[];
  avatarSrc?: string;
  onBroadcast: (text: string) => void;
  onLikeBroadcast: (id: string) => void;
  onCommentBroadcast: (id: string, text: string) => void;
  onNotify: (message: string) => void;
  onConnectWallet: () => void;
  onEnableNotifications: () => void;
  notificationsEnabled: boolean;
  onClose: () => void;
  onTip: (name: string, initials: string, color: string) => void;
}

const PEOPLE = [
  { name: 'Genesis', initials: 'G', color: 'coral', detail: 'Looking for the rooftop set', place: 'Kala Ghoda', live: true },
  { name: 'Amina', initials: 'A', color: 'yellow', detail: 'Just claimed 20 DEV', place: 'Churchgate', live: true },
  { name: 'Kai', initials: 'K', color: 'blue', detail: 'Live at the Courtyard stage', place: 'Fort', live: true },
  { name: 'Mara', initials: 'M', color: 'pink', detail: 'Pinned a table for friends', place: 'Kala Ghoda', live: false },
  { name: 'Tobi', initials: 'T', color: 'mint', detail: 'Joined the Dev meetup', place: 'Fort', live: true },
];

const COMMUNITY_ACTIVITY = [
  { id: 'live-1', kind: 'claim', text: 'Amina claimed 20 DEV at The Foundry', at: Date.now() - 3 * 60_000, place: 'Kala Ghoda' },
  { id: 'live-2', kind: 'join', text: 'Kai went live at the Courtyard stage', at: Date.now() - 8 * 60_000, place: 'Fort' },
  { id: 'live-3', kind: 'join', text: 'Tobi joined the Dev meetup', at: Date.now() - 14 * 60_000, place: 'Fort' },
  { id: 'live-4', kind: 'tip', text: 'First Round drop has 6 left', at: Date.now() - 21 * 60_000, place: 'Flora Fountain' },
];

export function CitySocialSheet({ open, view, activity, broadcasts, avatarSrc, onBroadcast, onLikeBroadcast, onCommentBroadcast, onNotify, onConnectWallet, onEnableNotifications, notificationsEnabled, onClose, onTip }: CitySocialSheetProps) {
  const [query, setQuery] = useState('');
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');
  const [chatActionError, setChatActionError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const xmtp = useXmtpChat(open && view === 'chat', onNotify);

  const filteredPeople = useMemo(() => PEOPLE.filter((person) =>
    `${person.name} ${person.detail} ${person.place}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const thread = xmtp.threads.find((item) => item.id === xmtp.activeThreadId);
  const title = view === 'feed' ? 'Around the city' : view === 'people' ? 'People nearby' : thread ? shortInbox(thread.peerInboxId) : 'Your chats';

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

  function sendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!broadcastDraft.trim()) return;
    onBroadcast(broadcastDraft);
    setBroadcastDraft('');
  }

  function sendBroadcastComment(event: FormEvent<HTMLFormElement>, broadcastId: string) {
    event.preventDefault();
    const text = commentDrafts[broadcastId]?.trim();
    if (!text) return;
    onCommentBroadcast(broadcastId, text);
    setCommentDrafts((drafts) => ({ ...drafts, [broadcastId]: '' }));
  }

  return (
    <Sheet open={open && view !== null} onClose={onClose} eyebrow="MUMBAI · YOUR CITY" title={title}>
      {view === 'feed' && (
        <div className="social-feed">
          <div className="social-live-line"><span className="live-dot" /> LIVE IN FORT <span>·</span> moments from the city</div>
          <form className="broadcast-composer" onSubmit={sendBroadcast}>
            <span className="broadcast-composer-avatar">{avatarSrc ? <img src={avatarSrc} alt="" /> : 'Y'}</span>
            <textarea value={broadcastDraft} onChange={(event) => setBroadcastDraft(event.target.value.slice(0, 240))} placeholder="What's happening around you?" rows={2} aria-label="Write a city broadcast" />
            <div className="broadcast-composer-bottom"><small>{broadcastDraft.length}/240 · saved in this browser</small><button type="submit" disabled={!broadcastDraft.trim()}><RadioIcon /> Broadcast</button></div>
          </form>
          {broadcasts.map((broadcast) => (
            <article className="broadcast-card" key={broadcast.id}>
              <header><span className="broadcast-composer-avatar">{avatarSrc ? <img src={avatarSrc} alt="" /> : 'Y'}</span><span><strong>You</strong><small>{timeAgo(broadcast.at)} · Mumbai</small></span><span className="broadcast-pulse" title="Your city signal is live" /></header>
              <p className="broadcast-copy">{broadcast.text}</p>
              <div className="broadcast-actions">
                <button className={broadcast.liked ? 'is-liked' : ''} onClick={() => onLikeBroadcast(broadcast.id)} aria-label={broadcast.liked ? 'Unlike broadcast' : 'Like broadcast'}><Heart size={15} fill={broadcast.liked ? 'currentColor' : 'none'} /> {broadcast.likes}</button>
                <button onClick={() => setCommentingId(commentingId === broadcast.id ? null : broadcast.id)}><MessageCircle size={15} /> {broadcast.comments.length} comments</button>
                <span className="broadcast-radius">YOUR MAP SIGNAL</span>
              </div>
              {broadcast.comments.map((comment) => <p className="broadcast-comment" key={comment.id}><strong>You</strong> {comment.text}</p>)}
              {commentingId === broadcast.id && <form className="broadcast-comment-form" onSubmit={(event) => sendBroadcastComment(event, broadcast.id)}>
                <input value={commentDrafts[broadcast.id] ?? ''} onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [broadcast.id]: event.target.value.slice(0, 240) }))} placeholder="Add a comment" aria-label="Add a comment" />
                <button type="submit" disabled={!commentDrafts[broadcast.id]?.trim()} aria-label="Post comment"><Send size={14} /></button>
              </form>}
            </article>
          ))}
          {[...activity.map((item) => ({ ...item, place: 'Mumbai' })), ...COMMUNITY_ACTIVITY]
            .sort((a, b) => b.at - a.at)
            .map((item) => (
              <article className="feed-item" key={item.id}>
                <span className={`feed-item-icon feed-${item.kind}`}>
                  {item.kind === 'claim' ? '🎁' : item.kind === 'tip' ? '✨' : '👋'}
                </span>
                <div className="feed-item-copy">
                  <p>{item.text}</p>
                  <span><MapPin size={12} /> {item.place} <i /> {timeAgo(item.at)}</span>
                </div>
                <Sparkles size={15} className="feed-spark" />
              </article>
            ))}
          <button className="social-map-link" onClick={onClose}><MapPin size={15} /> Back to the map</button>
        </div>
      )}

      {view === 'people' && (
        <div className="social-people">
          <label className="social-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find someone in the city" /></label>
          <p className="social-section-label">IN THE CITY <span>{filteredPeople.length}</span></p>
          {filteredPeople.map((person) => (
            <article className="people-item" key={person.name}>
              <span className={`people-avatar tone-${person.color}`}><img src={dicebearAvatarUrl(person.name, avatarBackgroundForColor(person.color))} alt={`${person.name}'s avatar`} />{person.live && <i />}</span>
              <div className="people-copy"><strong>{person.name}</strong><span>{person.detail}</span><small><MapPin size={11} /> {person.place} · approximate</small></div>
              <button className="people-message" onClick={() => onTip(person.name, person.initials, person.color)} aria-label={`Tip ${person.name}`} title={`Tip ${person.name}`}><Sparkles size={17} /></button>
            </article>
          ))}
          {filteredPeople.length === 0 && <p className="social-empty">No one by that name is in this part of the city yet.</p>}
        </div>
      )}

      {view === 'chat' && (
        <div className="social-chat">
          {!xmtp.isWalletConnected ? (
            <div className="xmtp-state">
              <span className="xmtp-state-icon"><MessageCircle size={21} /></span>
              <strong>Private chats, tied to your wallet</strong>
              <p>Your messages are end-to-end encrypted with XMTP. Connect the wallet you want to use for messaging.</p>
              <button className="outside-cta" onClick={onConnectWallet}>Connect wallet</button>
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
            <div className="xmtp-state"><span className="spinner" /><strong>Connecting to XMTP…</strong><p>Approve the message in your wallet to open your inbox.</p></div>
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
  return <Sparkles size={14} />;
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