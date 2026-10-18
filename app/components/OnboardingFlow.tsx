'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Gift, UsersRound, Radio, Wallet, ArrowRight, Check } from 'lucide-react';
import { PushButton } from './PushButton';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

type Step = 'welcome' | 'map' | 'drops' | 'social' | 'wallet' | 'complete';

const STEPS: Step[] = ['welcome', 'map', 'drops', 'social', 'wallet', 'complete'];

const STEP_CONTENT: Record<
  Step,
  {
    title: string;
    description: string;
    icon: any;
    action?: string;
  }
> = {
  welcome: {
    title: 'Welcome to DEVCITY',
    description: 'Your location-based social layer for Devcon Mumbai. Connect, explore, and engage with the community.',
    icon: MapPin,
  },
  map: {
    title: 'Explore the City',
    description: 'Navigate the interactive map to discover events, drops, and people nearby. Filter by what matters to you.',
    icon: MapPin,
    action: 'Try the map filters',
  },
  drops: {
    title: 'Claim Token Drops',
    description: 'Find and claim location-based token drops scattered around the venue. Check the map for green gift icons.',
    icon: Gift,
    action: 'Find a drop on the map',
  },
  social: {
    title: 'Connect with People',
    description: 'Share broadcasts, send tips, and follow other attendees. Your presence helps others find you too.',
    icon: UsersRound,
    action: 'Post your first broadcast',
  },
  wallet: {
    title: 'Your Wallet',
    description: 'Access your passkey wallet to send tokens, trade, and manage your digital assets securely.',
    icon: Wallet,
    action: 'Open your wallet',
  },
  complete: {
    title: 'You\'re All Set!',
    description: 'You\'re ready to explore DEVCITY. Start by checking the map for nearby drops and events.',
    icon: Check,
  },
};

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [skipped, setSkipped] = useState(false);

  const currentIndex = STEPS.indexOf(currentStep);
  const content = STEP_CONTENT[currentStep];
  const Icon = content.icon;
  const isLastStep = currentStep === 'complete';

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    onSkip();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <button onClick={handleSkip} className="onboarding-skip" aria-label="Skip onboarding">
          <X size={20} />
        </button>

        <div className="onboarding-content">
          <div className="onboarding-icon">
            <Icon size={48} strokeWidth={1.5} />
          </div>

          <h2 className="onboarding-title">{content.title}</h2>
          <p className="onboarding-description">{content.description}</p>

          {content.action && (
            <div className="onboarding-action">
              <span className="onboarding-action-text">{content.action}</span>
            </div>
          )}

          <div className="onboarding-progress">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`onboarding-progress-dot ${index <= currentIndex ? 'is-active' : ''} ${index === currentIndex ? 'is-current' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="onboarding-footer">
          <PushButton onClick={handleNext} className="onboarding-button">
            {isLastStep ? 'Start Exploring' : 'Continue'}
            <ArrowRight size={18} />
          </PushButton>
        </div>
      </div>
    </div>
  );
}
