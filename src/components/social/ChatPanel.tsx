'use client';

import { useState, type FormEvent } from 'react';
import { Send, MessageCircle, Lock } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { getInitials, formatTimeAgo } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { demoPeople } from '@/lib/demo-data';

interface ChatMessage {
  id: string;
  from: 'me' | 'them';
  text: string;
  at: number;
}

const SEED_MESSAGES: ChatMessage[] = [
  { id: 'm1', from: 'them', text: 'Hey! Are you at the main stage?', at: Date.now() - 12 * 60_000 },
  { id: 'm2', from: 'me', text: 'Almost — grabbing a coffee first ☕', at: Date.now() - 10 * 60_000 },
  { id: 'm3', from: 'them', text: 'The drop at KICC is still live, hurry!', at: Date.now() - 3 * 60_000 },
];

export function ChatPanel() {
  const { user } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState(demoPeople[0]?.username || 'alice');

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages((m) => [...m, { id: `m-${Date.now()}`, from: 'me', text: draft, at: Date.now() }]);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3">
        <MessageCircle className="h-4 w-4 text-gray-400" />
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="input-base h-9 flex-1 text-sm"
        >
          {demoPeople.map((p) => (
            <option key={p.id} value={p.username}>{p.username}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.map((message) => {
          const isMe = message.from === 'me';
          return (
            <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-3.5 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                }`}>
                  {message.text}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTimeAgo(message.at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={user?.avatarUrl} alt={user?.username} />
          <AvatarFallback>{getInitials(user?.username || 'You')}</AvatarFallback>
        </Avatar>
        <form onSubmit={send} className="flex flex-1 gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${recipient}…`}
            className="input-base h-10 flex-1"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="flex items-center justify-center gap-1 text-[10px] text-gray-400 mt-2">
        <Lock className="h-3 w-3" /> Local demo chat — encrypted messaging ships with the backend
      </p>
    </div>
  );
}
