'use client';

import { useEffect, useState } from 'react';

export function formatUsd(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function useUsdPrices() {
  const [usd, setUsd] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    setLoading(true);
    fetch('/api/prices')
      .then((response) => response.json())
      .then((data: { usd?: Record<string, number> }) => {
        if (!gone && data.usd) setUsd(data.usd);
      })
      .catch(() => {})
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [tick]);

  return { usd, loading, reload: () => setTick((value) => value + 1) };
}
