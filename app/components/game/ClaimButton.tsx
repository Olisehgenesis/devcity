'use client';

import type { ButtonHTMLAttributes } from 'react';

/**
 * Game-styled claim/primary button: chunky border + hard shadow + pop on press.
 */
export function ClaimButton({
  claimed = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { claimed?: boolean }) {
  return (
    <button className={`claim-button game-cta${claimed ? ' is-claimed' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}
