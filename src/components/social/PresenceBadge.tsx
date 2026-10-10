'use client';

import { cn } from '@/lib/utils';
import type { PresenceStatus } from '@/types';

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-amber-400',
  offline: 'bg-gray-400',
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

interface PresenceBadgeProps {
  status?: PresenceStatus;
  className?: string;
  showLabel?: boolean;
}

export function PresenceBadge({ status = 'offline', className, showLabel = false }: PresenceBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', STATUS_COLORS[status])} />
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', STATUS_COLORS[status])} />
      </span>
      {showLabel && <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{STATUS_LABELS[status]}</span>}
    </span>
  );
}
