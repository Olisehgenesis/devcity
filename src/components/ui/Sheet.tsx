'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>>(
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
);

SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: 'bottom' | 'top' | 'left' | 'right' }>(
  ({ className, children, side = 'bottom', ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 dark:bg-gray-900',
          side === 'bottom' &&
            'w-full bottom-0 left-0 right-0 rounded-t-[2rem] border-t border-gray-100 dark:border-gray-800 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          side === 'top' &&
            'w-full top-0 left-0 right-0 rounded-b-[2rem] border-b border-gray-100 dark:border-gray-800 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
          side === 'left' &&
            'h-full top-0 left-0 bottom-0 rounded-r-[2rem] border-r border-gray-100 dark:border-gray-800 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'right' &&
            'h-full top-0 right-0 bottom-0 rounded-l-[2rem] border-l border-gray-100 dark:border-gray-800 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <SheetClose className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-5 w-5" />
          </SheetClose>
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
);

SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);

const SheetTitle = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Title>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-gray-900 dark:text-gray-100', className)} {...props} />
  )
);

SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-gray-500 dark:text-gray-400', className)} {...props} />
));

SheetDescription.displayName = SheetPrimitive.Description.displayName;

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };