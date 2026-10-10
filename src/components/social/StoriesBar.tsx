'use client';

import { useAppStore } from '@/lib/store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { getInitials } from '@/lib/utils';
import type { Story } from '@/types';

interface StoriesBarProps {
  onOpen: (story: Story) => void;
}

export function StoriesBar({ onOpen }: StoriesBarProps) {
  const { stories, user } = useAppStore();

  if (stories.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar">
      {stories.map((story) => (
        <button
          key={story.id}
          onClick={() => onOpen(story)}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <span className="p-[2.5px] rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-blue-500 group-hover:scale-105 transition-transform">
            <span className="block p-[2.5px] rounded-full bg-white dark:bg-gray-950">
              <Avatar className="h-14 w-14">
                <AvatarImage src={story.avatarUrl} alt={story.username} />
                <AvatarFallback>{getInitials(story.username)}</AvatarFallback>
              </Avatar>
            </span>
          </span>
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 max-w-[64px] truncate">
            {story.username === user?.username ? 'You' : story.username}
          </span>
        </button>
      ))}
    </div>
  );
}
