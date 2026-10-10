'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { getInitials, formatTimeAgo } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { Story } from '@/types';

const STORY_MS = 5000;

interface StoryViewerProps {
  story: Story | null;
  onClose: () => void;
}

export function StoryViewer({ story, onClose }: StoryViewerProps) {
  const { stories, setActiveStory } = useAppStore();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
    setPaused(false);
  }, [story?.id]);

  useEffect(() => {
    if (!story || paused) return;
    const timer = setTimeout(() => {
      const next = index + 1;
      if (next < stories.length) {
        setActiveStory(stories[next]);
      } else {
        onClose();
      }
    }, STORY_MS);
    return () => clearTimeout(timer);
  }, [story, index, paused, stories, onClose, setActiveStory]);

  useEffect(() => {
    if (!story) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, index, stories]);

  if (!story) return null;

  const goNext = () => {
    const next = index + 1;
    if (next < stories.length) setActiveStory(stories[next]);
    else onClose();
  };

  const goPrev = () => {
    if (index > 0) setActiveStory(stories[index - 1]);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${story.username}'s story`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
            style={{ width: paused ? undefined : '100%', animation: paused ? undefined : `storyProgress ${STORY_MS}ms linear forwards` }}
          />
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white" aria-label="Close story">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 py-2">
        <Avatar className="h-9 w-9 ring-2 ring-white/30">
          <AvatarImage src={story.avatarUrl} alt={story.username} />
          <AvatarFallback>{getInitials(story.username)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{story.username}</p>
          <p className="text-xs text-white/60 flex items-center gap-1">
            {story.place && <><MapPin className="h-3 w-3" /> {story.place} · </>}
            {formatTimeAgo(story.createdAt)}
          </p>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-6"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <p className="text-white text-xl leading-relaxed text-center max-w-md">{story.content}</p>
      </div>

      <div className="flex items-center justify-between px-4 py-6">
        <button onClick={goPrev} disabled={index === 0} className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30" aria-label="Previous story">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs text-white/50">{index + 1} / {stories.length}</span>
        <button onClick={goNext} className="p-2 rounded-full bg-white/10 text-white" aria-label="Next story">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <style jsx>{`
        @keyframes storyProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
