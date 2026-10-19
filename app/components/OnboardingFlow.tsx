'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  return (
    <div className="onboarding-overlay">
      <div className="profile-auth-gate onboarding-card">
        <Button type="button" variant="outline" size="icon" className="absolute top-4 right-4 rounded-full" onClick={onSkip} aria-label="Close welcome">
          <X size={18} />
        </Button>
        <div className="profile-gate-copy">
          <span className="profile-gate-kicker">DEVCITY</span>
          <h2>The map is the city</h2>
          <p>Drops, people, and events are on this map. Your profile is in the corner when you want to sign in.</p>
        </div>
        <Button type="button" onClick={onComplete}>Show the map</Button>
      </div>
    </div>
  );
}
