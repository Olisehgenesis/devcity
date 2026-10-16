'use client';

import type { ReactNode } from 'react';
import { Sheet } from '../Sheet';
import { DexMascot } from './DexMascot';

/**
 * BottomSheet — game-styled bottom sheet. Thin wrapper over the accessible
 * `Sheet` with an optional mascot in the header.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  mascot = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  mascot?: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} eyebrow={eyebrow}>
      {mascot && (
        <div className="sheet-mascot" aria-hidden="true">
          <DexMascot size={64} />
        </div>
      )}
      {children}
    </Sheet>
  );
}
