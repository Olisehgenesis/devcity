'use client';

import { useRef } from 'react';

export function PinBoxes({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');

  function commit(nextDigits: string[], focusIndex: number) {
    onChange(nextDigits.join('').replace(/\D/g, '').slice(0, 6));
    refs.current[Math.max(0, Math.min(focusIndex, 5))]?.focus();
  }

  function write(index: number, raw: string) {
    const chars = raw.replace(/\D/g, '').slice(0, 6);
    if (!chars) return;
    const next = digits.slice();
    chars.split('').forEach((char, offset) => {
      if (index + offset < 6) next[index + offset] = char;
    });
    commit(next, Math.min(index + chars.length, 5));
  }

  return (
    <div className="pin-boxes" role="group" aria-label="6-digit wallet PIN">
      {digits.map((digit, index) => (
        <input
          key={index}
          id={index === 0 ? id : undefined}
          ref={(node) => { refs.current[index] = node; }}
          className="pin-box"
          type="password"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          aria-label={`Digit ${index + 1} of 6`}
          onChange={(event) => write(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Backspace') return;
            if (digits[index]) {
              const next = digits.slice();
              next[index] = '';
              commit(next, index);
              event.preventDefault();
              return;
            }
            if (index > 0) {
              const next = digits.slice();
              next[index - 1] = '';
              commit(next, index - 1);
              event.preventDefault();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            write(index, event.clipboardData.getData('text'));
          }}
        />
      ))}
    </div>
  );
}

export function UnlockSecret({
  id,
  pinProtected,
  value,
  onChange,
}: {
  id: string;
  pinProtected?: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  if (pinProtected) return <PinBoxes id={id} value={value} onChange={onChange} />;
  return (
    <input
      id={id}
      type="password"
      className="you-passphrase"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Wallet passphrase"
      aria-label="Wallet passphrase"
      autoComplete="current-password"
    />
  );
}
