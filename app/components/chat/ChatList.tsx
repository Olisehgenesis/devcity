'use client';

import { useState, type FormEvent, type PointerEvent } from 'react';
import { MessageCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { XmtpThread } from '../../hooks/useXmtpChat';
import { timeAgo } from '../../lib/city-store';

type ChatListProps = {
  threads: XmtpThread[];
  names: Record<string, string>;
  unread: Record<string, number>;
  muted: Record<string, true>;
  query: string;
  recipient: string;
  onQuery: (value: string) => void;
  onRecipient: (value: string) => void;
  onOpen: (threadId: string) => void;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onHide: (threadId: string) => void;
  onMute: (threadId: string) => void;
};

export function ChatList({
  threads,
  names,
  unread,
  muted,
  query,
  recipient,
  onQuery,
  onRecipient,
  onOpen,
  onStart,
  onHide,
  onMute,
}: ChatListProps) {
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const visible = threads.filter((thread) => {
    const label = (names[thread.id] ?? thread.peerInboxId).toLowerCase();
    const preview = thread.lastMessage?.text.toLowerCase() ?? '';
    const needle = query.trim().toLowerCase();
    return !needle || label.includes(needle) || preview.includes(needle);
  });

  return (
    <div className="chat-list">
      <label className="chat-search">
        <Search size={15} aria-hidden />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search" aria-label="Search chats" />
      </label>
      {visible.map((thread) => (
        <ChatRow
          key={thread.id}
          thread={thread}
          name={names[thread.id] ?? shortInbox(thread.peerInboxId)}
          unread={unread[thread.id] ?? 0}
          muted={Boolean(muted[thread.id])}
          revealed={openSwipe === thread.id}
          onReveal={(open) => setOpenSwipe(open ? thread.id : null)}
          onOpen={() => onOpen(thread.id)}
          onHide={() => onHide(thread.id)}
          onMute={() => onMute(thread.id)}
        />
      ))}
      {visible.length === 0 && <p className="social-empty">{query ? 'No chats match that search.' : 'Your inbox is empty. Start a chat with a wallet address.'}</p>}
      <form className="xmtp-new-chat" onSubmit={onStart}>
        <input value={recipient} onChange={(event) => onRecipient(event.target.value)} placeholder="New chat, 0x wallet address" aria-label="Recipient wallet address" />
        <button type="submit" disabled={!recipient.trim()} aria-label="Start a new chat"><Plus size={16} /></button>
      </form>
    </div>
  );
}

function ChatRow({
  thread,
  name,
  unread,
  muted,
  revealed,
  onReveal,
  onOpen,
  onHide,
  onMute,
}: {
  thread: XmtpThread;
  name: string;
  unread: number;
  muted: boolean;
  revealed: boolean;
  onReveal: (open: boolean) => void;
  onOpen: () => void;
  onHide: () => void;
  onMute: () => void;
}) {
  const [drag, setDrag] = useState(0);
  const [origin, setOrigin] = useState<number | null>(null);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (origin === null) return;
    setDrag(Math.max(-148, Math.min(0, event.clientX - origin)));
  }

  return (
    <div className="thread-swipe">
      <div className="thread-swipe-actions">
        <Button type="button" variant="outline" onClick={onMute}>{muted ? 'Muted' : 'Mute'}</Button>
        <Button type="button" variant="outline" onClick={onHide}>Delete</Button>
      </div>
      <div
        className="thread-item"
        style={{ transform: `translateX(${revealed ? -148 : drag}px)` }}
        onPointerDown={(event) => { setOrigin(event.clientX - (revealed ? -148 : 0)); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={move}
        onPointerUp={() => {
          onReveal(drag < -72 || (revealed && drag > -40));
          setDrag(0);
          setOrigin(null);
        }}
        onPointerCancel={() => { setDrag(0); setOrigin(null); }}
      >
        <button type="button" className="thread-open" onClick={onOpen}>
          <span className="people-avatar"><MessageCircle size={16} /></span>
          <span className="thread-copy">
            <strong>{name}</strong>
            <small>{thread.lastMessage?.text ?? 'No messages yet'}</small>
          </span>
          <span className="thread-end">
            <small>{thread.lastMessage ? timeAgo(thread.lastMessage.sentAt.getTime()) : ''}</small>
            {unread > 0 && <i>{unread}</i>}
          </span>
        </button>
      </div>
    </div>
  );
}

function shortInbox(inboxId: string) {
  return inboxId.length > 16 ? `${inboxId.slice(0, 7)}…${inboxId.slice(-5)}` : inboxId;
}
