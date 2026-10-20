'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ChatReadState = {
  lastReadAt: Record<string, number>;
  hidden: Record<string, true>;
  muted: Record<string, true>;
  markRead: (conversationId: string) => void;
  hide: (conversationId: string) => void;
  mute: (conversationId: string) => void;
};

export const useChatRead = create<ChatReadState>()(persist((set) => ({
  lastReadAt: {},
  hidden: {},
  muted: {},
  markRead: (conversationId) => set((state) => ({
    lastReadAt: { ...state.lastReadAt, [conversationId]: Date.now() },
  })),
  hide: (conversationId) => set((state) => ({
    hidden: { ...state.hidden, [conversationId]: true },
  })),
  mute: (conversationId) => set((state) => ({
    muted: { ...state.muted, [conversationId]: true },
  })),
}), { name: 'devcity-chat-read' }));
