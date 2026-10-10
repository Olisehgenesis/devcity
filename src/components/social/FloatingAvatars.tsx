'use client';

import { useMemo } from 'react';

const AVATARS = [
  { seed: 'genesis-nairobi', bg: 'ff795f', top: '12%', left: '6%', size: 44, delay: 0, duration: 9 },
  { seed: 'amina-nairobi', bg: 'ffd75e', top: '20%', left: '88%', size: 38, delay: 1.2, duration: 11 },
  { seed: 'kai-nairobi', bg: '83d8ee', top: '70%', left: '8%', size: 40, delay: 0.6, duration: 10 },
  { seed: 'mara-nairobi', bg: 'f5a6c6', top: '78%', left: '90%', size: 36, delay: 1.8, duration: 12 },
  { seed: 'tobi-nairobi', bg: '8bffcc', top: '45%', left: '4%', size: 32, delay: 2.4, duration: 8.5 },
  { seed: 'zuri-nairobi', bg: 'd6ff55', top: '55%', left: '94%', size: 34, delay: 0.9, duration: 10.5 },
];

export function FloatingAvatars() {
  const avatars = useMemo(() => AVATARS, []);

  return (
    <div className="floating-avatars" aria-hidden="true">
      {avatars.map((a) => (
        <img
          key={a.seed}
          src={`https://api.dicebear.com/9.x/notionists/svg?seed=${a.seed}&backgroundColor=${a.bg}`}
          alt=""
          className="floating-avatar"
          style={{
            top: a.top,
            left: a.left,
            width: a.size,
            height: a.size,
            animationDelay: `${a.delay}s`,
            animationDuration: `${a.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
