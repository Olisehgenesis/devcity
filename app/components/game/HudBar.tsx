'use client';

import { useGameStore } from '../../lib/game-store';
import { DexMascot } from './DexMascot';

/**
 * HudBar — the game HUD: mascot, level, streak + activity/badge summary.
 * Progress comes from real on-chain activity (claims, tips, events, spots).
 * Purely local/cosmetic; never financial.
 */
export function HudBar({ streak }: { streak?: number }) {
  const { level, counts, streak: s, badges } = useGameStore();
  const streakCount = streak ?? s;
  const streakDay = streakCount <= 1 ? 'today' : `${streakCount} day${streakCount > 1 ? 's' : ''}`;
  const actions = counts.total;

  return (
    <div className="hud-bar" aria-label={`Level ${level}, ${actions} city actions`}>
      <DexMascot size={46} />
      <div className="hud-meta">
        <div className="hud-line">
          <strong>Lv {level}</strong>
          <span className="hud-xp">{actions} action{actions === 1 ? '' : 's'}</span>
          {streakCount > 0 && (
            <span className="hud-streak" title={`${streakCount}-day streak`}>🔥 {streakDay}</span>
          )}
        </div>
        <div className="hud-badges">
          {badges.length > 0 ? (
            <span className="hud-badge-count">{badges.length} badge{badges.length > 1 ? 's' : ''} earned</span>
          ) : (
            <span className="hud-badge-count">Claim a drop or RSVP to earn badges</span>
          )}
        </div>
      </div>
    </div>
  );
}
