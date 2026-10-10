'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  ready: boolean;
}

export function LoadingOverlay({ ready }: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const mountTime = useRef(Date.now());
  const MIN_SHOW_MS = 1800;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (ready && mounted) {
      const elapsed = Date.now() - mountTime.current;
      const wait = Math.max(0, MIN_SHOW_MS - elapsed);
      const timer = setTimeout(() => setLeaving(true), wait);
      return () => clearTimeout(timer);
    }
  }, [ready, mounted]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setGone(true), 400);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (gone) return null;

  return (
    <div className={cn('city-intro', leaving && 'is-leaving')} aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="city-loader-art" src="/assets/loading.svg" alt="DEVCITY26" />
      <strong>DEVCITY26</strong>
      <span className="intro-beta">[BETA]</span>
      <span className="intro-edition">NAIROBI EDITION</span>
      <span className="intro-loading">
        {ready ? 'CITY READY' : 'LOADING CITY'}
        <i /><i /><i />
      </span>
    </div>
  );
}
