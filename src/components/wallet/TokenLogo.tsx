'use client';

import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  DEV26: 'from-slate-900 to-zinc-700',
  USDT: 'from-emerald-500 to-teal-600',
  CELO: 'from-yellow-500 to-amber-600',
};

export function TokenLogo({ symbol = '?', size = 40, className }: { symbol?: string; size?: number; className?: string }) {
  const key = (symbol || '?').toUpperCase();
  const g = COLORS[key] || 'from-slate-500 to-slate-400';
  return (
    <div
      className={cn('flex items-center justify-center rounded-full font-bold text-white bg-gradient-to-br shrink-0', g, className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      <span>{key.slice(0, 4)}</span>
    </div>
  );
}

export function TokenLogoAvatar({ symbol }: { symbol?: string }) {
  return <TokenLogo symbol={symbol} />;
}
