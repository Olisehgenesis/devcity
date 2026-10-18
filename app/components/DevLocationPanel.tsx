'use client';

import { useEffect, useState } from 'react';

export type DevLocationMode = 'off' | 'near' | 'far' | 'denied';

type TestPlace = {
  id: string;
  kind: 'drop' | 'place' | 'event';
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
};

type Payload = {
  enabled: true;
  label: 'TEST';
  near: { latitude: number; longitude: number };
  far: { latitude: number; longitude: number };
  places: TestPlace[];
};

export type DevLocationApply = {
  mode: DevLocationMode;
  position: { latitude: number; longitude: number } | null;
  places: TestPlace[];
};

export type DevLocationPanelProps = {
  onChange: (next: DevLocationApply) => void;
};

export function DevLocationPanel({ onChange }: DevLocationPanelProps) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [mode, setMode] = useState<DevLocationMode>('off');

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let cancelled = false;
    fetch('/api/dev/location')
      .then(async (response) => (response.ok ? response.json() as Promise<Payload> : null))
      .then((body) => {
        if (cancelled || !body?.enabled || body.label !== 'TEST') return;
        const places = (body.places ?? []).filter((place) => place.name.startsWith('TEST ') && place.id.startsWith('test-'));
        if (places.length === 0) return;
        setPayload({ ...body, places });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (process.env.NODE_ENV === 'production' || !payload) return null;

  function choose(next: DevLocationMode) {
    if (!payload) return;
    setMode(next);
    if (next === 'off') {
      onChange({ mode: 'off', position: null, places: [] });
      return;
    }
    if (next === 'denied') {
      onChange({ mode: 'denied', position: null, places: payload.places });
      return;
    }
    onChange({
      mode: next,
      position: next === 'near' ? payload.near : payload.far,
      places: payload.places,
    });
  }

  return (
    <fieldset className="dev-location-panel">
      <legend>TEST location</legend>
      <button type="button" aria-pressed={mode === 'off'} onClick={() => choose('off')}>Real GPS</button>
      <button type="button" aria-pressed={mode === 'near'} onClick={() => choose('near')}>TEST near</button>
      <button type="button" aria-pressed={mode === 'far'} onClick={() => choose('far')}>TEST far</button>
      <button type="button" aria-pressed={mode === 'denied'} onClick={() => choose('denied')}>TEST denied</button>
    </fieldset>
  );
}
