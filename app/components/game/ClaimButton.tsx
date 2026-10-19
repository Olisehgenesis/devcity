'use client';

import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

/** Same themed button as the map actions. A finished claim uses the outline style. */
export function ClaimButton({
  claimed = false,
  variant,
  children,
  ...rest
}: ComponentProps<typeof Button> & { claimed?: boolean }) {
  return (
    <Button variant={claimed ? 'outline' : variant} {...rest}>
      {children}
    </Button>
  );
}
