'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'gradient';
  size?: 'default' | 'sm' | 'lg';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm',
      secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
      destructive: 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm',
      outline: 'border-2 border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300',
      success: 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-sm',
      warning: 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white shadow-sm',
      gradient: 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-sm',
    };

    const sizes = {
      default: 'px-2.5 py-0.5 text-xs',
      sm: 'px-2 py-0 text-[10px]',
      lg: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };