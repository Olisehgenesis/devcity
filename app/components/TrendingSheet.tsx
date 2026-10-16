'use client';

import { useTrending, type TrendingData } from '../hooks/useTrending';
import { Sheet } from './Sheet';
import { TrendingUp, Hash, Calendar, Heart, MessageCircle, Flame } from 'lucide-react';
import { timeAgo } from '../lib/city-store';
import { DexMascot } from './game/DexMascot';

interface TrendingSheetProps {
  open: boolean;
  onClose: () => void;
}

export function TrendingSheet({ open, onClose }: TrendingSheetProps) {
  const { data, loading, error } = useTrending();

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Mumbai · what&apos;s hot" title="Trending">
      <div className="gsheet">
        {loading ? (
          <div className="gsheet-loading">Gathering what&apos;s hot in the city…</div>
        ) : error ? (
          <div className="gsheet-error">{error}</div>
        ) : data && (data.hashtags?.length || data.broadcasts?.length || data.events?.length) ? (
          <>
            {data.hashtags && data.hashtags.length > 0 && (
              <div className="gsheet-section">
                <h3><Flame size={16} /> Trending hashtags</h3>
                <div className="flex flex-wrap gap-2">
                  {data.hashtags.map((tag) => (
                    <a key={tag.id} href={`/hashtag/${tag.tag}`} className="gsheet-chip">
                      <Hash size={14} />#{tag.tag}
                      <span className="opacity-60">{tag.usageCount}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {data.broadcasts && data.broadcasts.length > 0 && (
              <div className="gsheet-section">
                <h3><TrendingUp size={16} /> Hot broadcasts</h3>
                {data.broadcasts.map((b) => (
                  <div className="gsheet-card" key={b.id} style={{ marginBottom: 8 }}>
                    <small>@{b.username}</small>
                    <p>{b.text}</p>
                    <small>
                      <span className="inline-flex items-center gap-1"><Heart size={12} /> {b.likes}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {b.comments}</span>
                      <span>{timeAgo(new Date(b.createdAt).getTime())}</span>
                    </small>
                  </div>
                ))}
              </div>
            )}

            {data.events && data.events.length > 0 && (
              <div className="gsheet-section">
                <h3><Calendar size={16} /> Popular events</h3>
                {data.events.map((event) => (
                  <div className="gsheet-row" key={event.id}>
                    <div className="gsheet-copy">
                      <strong>{event.name}</strong>
                      <span>{event.organizer}</span>
                    </div>
                    <span className="gsheet-stat">{event.rsvpCount} RSVP</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="gsheet-empty">
            <DexMascot size={84} />
            <strong>Nothing trending yet</strong>
            <p>When the city gets loud, it shows up here first.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
