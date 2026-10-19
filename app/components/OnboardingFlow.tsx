'use client';

import { X } from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  return (
    <div className="onboarding-overlay">
      <div className="profile-auth-gate onboarding-card">
        <button type="button" onClick={onSkip} className="onboarding-skip" aria-label="Close welcome">
          <X size={18} />
        </button>
        <div className="profile-gate-copy">
          <span className="profile-gate-kicker">DEVCITY</span>
          <h2>The map is the city</h2>
          <p>Drops, people, and events are on this map. Your profile is in the corner when you want to sign in.</p>
        </div>
        <button type="button" className="you-connect-primary" onClick={onComplete}>Show the map</button>
      </div>
    </div>
  );
}
