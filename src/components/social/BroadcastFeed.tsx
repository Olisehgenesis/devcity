'use client';

import { useState, type FormEvent } from 'react';
import { Heart, MessageCircle, Send, MapPin, Sparkles } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { getInitials, formatTimeAgo } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Broadcast, ActivityItem } from '@/types';

const ACTIVITY_ICONS: Record<ActivityItem['kind'], string> = {
  claim: '🎁',
  tip: '✨',
  join: '👋',
  broadcast: '📢',
  story: '🖼️',
};

export function BroadcastFeed() {
  const {
    broadcasts,
    activity,
    user,
    createBroadcast,
    likeBroadcast,
    commentBroadcast,
  } = useAppStore();
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingId, setCommentingId] = useState<string | null>(null);

  const sendBroadcast = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    void createBroadcast(draft);
    setDraft('');
  };

  const sendComment = (e: FormEvent, id: string) => {
    e.preventDefault();
    const text = commentDrafts[id]?.trim();
    if (!text) return;
    void commentBroadcast(id, text);
    setCommentDrafts((d) => ({ ...d, [id]: '' }));
  };

  const sortedActivity = [...activity].sort((a, b) => b.at - a.at).slice(0, 20);

  return (
    <div className="space-y-4">
      <form onSubmit={sendBroadcast} className="card-base p-3 space-y-2">
        <div className="flex gap-2.5">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user?.avatarUrl} alt={user?.username} />
            <AvatarFallback>{getInitials(user?.username || 'You')}</AvatarFallback>
          </Avatar>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 240))}
            placeholder="What's happening around you?"
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{draft.length}/240</span>
          <Button type="submit" size="sm" disabled={!draft.trim()}>
            <Send className="h-3.5 w-3.5" /> Broadcast
          </Button>
        </div>
      </form>

      {broadcasts.length === 0 && sortedActivity.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
          No city signals yet. Be the first to broadcast.
        </p>
      )}

      {broadcasts.map((broadcast) => (
        <article key={broadcast.id} className="card-base p-4 space-y-3">
          <header className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={broadcast.avatarUrl} alt={broadcast.username} />
              <AvatarFallback>{getInitials(broadcast.username || '?')}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {broadcast.username === user?.username ? 'You' : broadcast.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(broadcast.at)}</p>
            </div>
            <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">City signal</span>
          </header>

          <p className="text-sm text-gray-800 dark:text-gray-200">{broadcast.text}</p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => void likeBroadcast(broadcast.id)}
              className={`flex items-center gap-1.5 text-sm transition-colors ${broadcast.liked ? 'text-pink-500' : 'text-gray-500 dark:text-gray-400 hover:text-pink-500'}`}
            >
              <Heart className="h-4 w-4" fill={broadcast.liked ? 'currentColor' : 'none'} />
              {broadcast.likes}
            </button>
            <button
              onClick={() => setCommentingId(commentingId === broadcast.id ? null : broadcast.id)}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <MessageCircle className="h-4 w-4" />
              {broadcast.comments.length}
            </button>
          </div>

          {broadcast.comments.length > 0 && (
            <div className="space-y-1.5">
              {broadcast.comments.map((comment) => (
                <p key={comment.id} className="text-sm text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-gray-100">{comment.username || 'Someone'}</strong>{' '}
                  {comment.text}
                </p>
              ))}
            </div>
          )}

          {commentingId === broadcast.id && (
            <form onSubmit={(e) => sendComment(e, broadcast.id)} className="flex gap-2">
              <input
                value={commentDrafts[broadcast.id] ?? ''}
                onChange={(e) => setCommentDrafts((d) => ({ ...d, [broadcast.id]: e.target.value.slice(0, 240) }))}
                placeholder="Add a comment"
                className="input-base h-9"
              />
              <Button type="submit" size="icon" disabled={!commentDrafts[broadcast.id]?.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </article>
      ))}

      {sortedActivity.length > 0 && (
        <>
          <Separator />
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase px-1">Around the city</p>
          <div className="space-y-1">
            {sortedActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <span className="text-lg leading-none mt-0.5">{ACTIVITY_ICONS[item.kind]}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{item.text}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {formatTimeAgo(item.at)}
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-gray-300 dark:text-gray-600" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
