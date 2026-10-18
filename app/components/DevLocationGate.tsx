'use client';

import { useEffect, useState, type ComponentType } from 'react';
import type { DevLocationPanelProps } from './DevLocationPanel';

/**
 * The panel import sits in the non-production branch so a production build
 * can drop it. Real geolocation stays in place when this renders nothing.
 */
export function DevLocationGate(props: DevLocationPanelProps) {
  const [Panel, setPanel] = useState<ComponentType<DevLocationPanelProps> | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    void import('./DevLocationPanel').then((mod) => {
      setPanel(() => mod.DevLocationPanel);
    });
  }, []);

  if (process.env.NODE_ENV === 'production' || !Panel) return null;
  return <Panel {...props} />;
}
