'use client';

import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { FeeUnpayableError, quoteCeloFee, type FeeQuote, type TxRequest } from '@/lib/gas';

export function useFeeQuote(account: string | null | undefined, request: TxRequest | null) {
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const key = request ? `${request.to}:${request.data ?? ''}:${request.value?.toString() ?? ''}` : '';

  useEffect(() => {
    if (!account || !request) {
      setQuote(null);
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      void quoteCeloFee(account as Address, request)
        .then((next) => {
          if (cancelled) return;
          setQuote(next);
          setLoading(false);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setQuote(null);
          setError(reason instanceof FeeUnpayableError || reason instanceof Error ? reason.message : 'Could not estimate the network fee.');
          setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `key` is the serialized request, so the object identity is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, key]);

  return { quote, error, loading };
}
