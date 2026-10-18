'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { getUnlockedPrivateKey } from '@/lib/unlocked-wallet';

export function useUnlockedKey(address?: string | null): Hex | null {
  const [key, setKey] = useState<Hex | null>(null);

  useEffect(() => {
    const sync = () => setKey(address ? getUnlockedPrivateKey(address) : null);
    sync();
    window.addEventListener('devcity-wallet-unlocked', sync);
    return () => window.removeEventListener('devcity-wallet-unlocked', sync);
  }, [address]);

  return key;
}
