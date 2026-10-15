'use client';

import { useTrending, type TrendingData } from '../hooks/useTrending';
import { Sheet } from './Sheet';
import { TrendingUp, Hash, Calendar, Heart, MessageCircle } from 'lucide-react';
import { timeAgo } from '../lib/city-store';

interface TrendingSheetProps {
  open: boolean;
  onClose: () => void;
}

export function TrendingSheet({ open, onClose }: TrendingSheetProps) {
  const { data, loading, error } = useTrending();

  return (
    <Sheet open={open} onClose={onClose} title="Trending">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <span className="font-semibold">Trending Now</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Trending Hashtags */}
              {data?.hashtags && data.hashtags.length > 0 && (
                <div className="p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <Hash className="w-4 h-4" />
                    Trending Hashtags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.map((tag) => (
                      <a
                        key={tag.id}
                        href={`/hashtag/${tag.tag}`}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        #{tag.tag}
                        <span className="ml-1 text-xs text-gray-500">{tag.usageCount}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Broadcasts */}
              {data?.broadcasts && data.broadcasts.length > 0 && (
                <div className="p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Hot Broadcasts
                  </h3>
                  <div className="space-y-3">
                    {data.broadcasts.map((broadcast) => (
                      <div
                        key={broadcast.id}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <p className="text-sm font-medium">@{broadcast.username}</p>
                        <p className="text-sm mt-1 line-clamp-2">{broadcast.text}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {broadcast.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {broadcast.comments}
                          </span>
                          <span>{timeAgo(new Date(broadcast.createdAt).getTime())}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Events */}
              {data?.events && data.events.length > 0 && (
                <div className="p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <Calendar className="w-4 h-4" />
                    Popular Events
                  </h3>
                  <div className="space-y-2">
                    {data.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{event.name}</p>
                          <p className="text-xs text-gray-500">{event.organizer}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-green-600">
                            {event.rsvpCount} RSVPs
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!data?.hashtags?.length && !data?.broadcasts?.length && !data?.events?.length && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <TrendingUp className="w-12 h-12 mb-2 opacity-50" />
                  <p>No trending content yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}