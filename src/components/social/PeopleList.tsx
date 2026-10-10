'use client';

import { useMemo, useState } from 'react';
import { Search, MapPin, Sparkles } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { demoPeople } from '@/lib/demo-data';
import { PresenceBadge } from '@/components/social/PresenceBadge';
import type { NearbyUser } from '@/types';

interface PeopleListProps {
  onTip: (name: string) => void;
}

export function PeopleList({ onTip }: PeopleListProps) {
  const { nearbyUsers } = useAppStore();
  const [query, setQuery] = useState('');

  const people: NearbyUser[] = useMemo(() => {
    if (nearbyUsers.length > 0) return nearbyUsers;
    return demoPeople.map((p) => ({
      id: p.id,
      username: p.username,
      walletAddress: p.id,
      avatarUrl: p.avatarUrl,
      status: (p.status === 'busy' ? 'online' : p.status) as NearbyUser['status'],
      distance: p.distance,
      lastActive: p.lastActive,
      tokenSymbol: p.tokenSymbol,
    }));
  }, [nearbyUsers]);

  const filtered = useMemo(
    () => people.filter((p) => `${p.username} ${p.tokenSymbol || ''}`.toLowerCase().includes(query.toLowerCase())),
    [people, query]
  );

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone in the city"
          className="input-base pl-9"
        />
      </label>

      <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
        In the city <span className="text-gray-600 dark:text-gray-300">{filtered.length}</span>
      </p>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
          No one by that name is in this part of the city yet.
        </p>
      )}

      <div className="space-y-1">
        {filtered.map((person) => (
          <div key={person.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div className="relative">
              <Avatar className="h-11 w-11">
                <AvatarImage src={person.avatarUrl} alt={person.username} />
                <AvatarFallback>{getInitials(person.username)}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5">
                <PresenceBadge status={person.status} />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{person.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {person.distance}m away
              </p>
            </div>
            {person.tokenSymbol && (
              <Badge variant="gradient" size="sm">{person.tokenSymbol}</Badge>
            )}
            <button
              onClick={() => onTip(person.username)}
              className="p-2 rounded-full text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              aria-label={`Tip ${person.username}`}
              title={`Tip ${person.username}`}
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
