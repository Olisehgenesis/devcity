'use client';

import { useEffect, useRef, useState } from 'react';
import type { Story } from '../lib/stories';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';

const SEGMENT_MS = 4500;
const TAP_MAX_MS = 350;

interface StoryViewerProps {
  story: Story | null;
  onClose: () => void;
}

export function StoryViewer({ story, onClose }: StoryViewerProps) {
  const [seg, setSeg] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  const remainingRef = useRef(SEGMENT_MS);
  const resetRef = useRef(false);
  const pressStartRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const open = story !== null;

  useEffect(() => {
    if (open) {
      setSeg(0);
      setPaused(false);
      setTick((t) => t + 1);
      remainingRef.current = SEGMENT_MS;
    }
  }, [open, story?.name]);

  useEffect(() => {
    if (!open || paused || !story) return;
    const start = Date.now();
    const timer = setTimeout(() => {
      resetRef.current = true;
      if (seg + 1 >= story.segments.length) {
        onCloseRef.current();
      } else {
        setSeg((s) => s + 1);
      }
    }, remainingRef.current);
    return () => {
      clearTimeout(timer);
      if (resetRef.current) {
        resetRef.current = false;
        remainingRef.current = SEGMENT_MS;
      } else {
        remainingRef.current = Math.max(350, remainingRef.current - (Date.now() - start));
      }
    };
  }, [open, paused, seg, story, tick]);

  const goNext = () => {
    if (!story) return;
    resetRef.current = true;
    if (seg + 1 >= story.segments.length) onCloseRef.current();
    else setSeg((s) => s + 1);
  };

  const goPrev = () => {
    resetRef.current = true;
    if (seg > 0) setSeg((s) => s - 1);
    else setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seg, story]);

  if (!story) return null;

  const tapStart = () => {
    pressStartRef.current = Date.now();
    setPaused(true);
  };

  const tapEnd = (dir: 'next' | 'prev') => {
    const held = Date.now() - pressStartRef.current;
    setPaused(false);
    if (held <= TAP_MAX_MS) {
      if (dir === 'next') goNext();
      else goPrev();
    }
  };

  const segment = story.segments[Math.min(seg, story.segments.length - 1)];

  return (
    <div
      className="viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${story.name}'s story`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`viewer${paused ? ' is-paused' : ''}`}>
        <div className="story-progress" aria-hidden="true">
          {story.segments.map((_, i) => (
            <span key={i} className="story-progress-track">
              <i
                className={i < seg ? 'is-done' : i === seg ? 'is-live' : ''}
                style={i === seg ? { animationDuration: `${SEGMENT_MS}ms` } : undefined}
              />
            </span>
          ))}
        </div>

        <header className="story-header">
          <span className={`story-avatar tone-${story.color}`}><img src={dicebearAvatarUrl(story.name, avatarBackgroundForColor(story.color))} alt="" /></span>
          <div className="story-meta">
            <strong>{story.name}</strong>
            <span>
              {story.time} · {story.place}
            </span>
          </div>
          <button className="story-close" onClick={onClose} aria-label="Close story">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <button
          className="story-tap story-tap-left"
          aria-label="Previous segment"
          onPointerDown={tapStart}
          onPointerUp={() => tapEnd('prev')}
          onPointerLeave={() => setPaused(false)}
        />
        <button
          className="story-tap story-tap-right"
          aria-label="Next segment"
          onPointerDown={tapStart}
          onPointerUp={() => tapEnd('next')}
          onPointerLeave={() => setPaused(false)}
        />

        <div className={`story-content tone-${story.color}`}>
          <div className="story-card">
            <p className="story-text">{segment.text}</p>
            {segment.sub && <p className="story-sub">{segment.sub}</p>}
          </div>
          <span className="story-place-chip">{story.place}</span>
          <span className="story-hint">{paused ? 'release to resume' : 'tap to continue'}</span>
        </div>
      </div>
    </div>
  );
}
