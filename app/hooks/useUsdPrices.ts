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

  useEffect(() => {
    let gone = false;
    fetch('/api/prices')
      .then((response) => response.json())
      .then((data: { usd?: Record<string, number> }) => {
        if (!gone && data.usd) setUsd(data.usd);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);

  return usd;
}
