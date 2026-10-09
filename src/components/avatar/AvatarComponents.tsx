'use client';

import { useState, useCallback } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { cn, getInitials as getInitialsFromUtil, getRandomColor } from '@/lib/utils';
import type { AvatarFeatures } from '@/lib/avatar';
import { generateDiceBearUrl, generateInitialsAvatar, DEFAULT_AVATAR_FEATURES, AVATAR_OPTIONS } from '@/lib/avatar';
import { Button } from '@/components/ui/Button';
import { cn as cnUtil } from '@/lib/utils';

interface AvatarDisplayProps {
  src?: string;
  name?: string;
  walletAddress?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  fallback?: React.ReactNode;
}

export function AvatarDisplay({
  src,
  name,
  walletAddress,
  size = 'md',
  className,
  fallback,
}: AvatarDisplayProps) {
  const sizeMap = { sm: 32, md: 40, lg: 56, xl: 80 };
  const sizeValue = typeof size === 'number' ? size : sizeMap[size];

  const getFallbackColor = () => {
    if (walletAddress) return getRandomColor(walletAddress);
    if (name) return getRandomColor(name);
    return '#3b82f6';
  };

  const getInitials = (label?: string) => {
    if (label) return getInitialsFromUtil(label);
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    if (walletAddress) return walletAddress.slice(2, 4).toUpperCase();
    return '?';
  };

  const imageSrc = src || (name ? generateInitialsAvatar(name, sizeValue) : walletAddress ? generateInitialsAvatar(walletAddress, sizeValue) : undefined);

  return (
    <Avatar className={cn('ring-2 ring-white dark:ring-gray-800', className)} style={{ width: sizeValue, height: sizeValue }}>
      <AvatarImage src={imageSrc} alt={name || walletAddress || 'Avatar'} />
      <AvatarFallback style={{ backgroundColor: getFallbackColor(), fontSize: sizeValue * 0.35 }}>
        {fallback || getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}

interface AvatarCustomizerProps {
  initialFeatures?: AvatarFeatures;
  onSave: (features: AvatarFeatures, imageUrl: string) => void;
  onCancel?: () => void;
  size?: number;
}

export function AvatarCustomizer({ initialFeatures = DEFAULT_AVATAR_FEATURES, onSave, onCancel, size = 200 }: AvatarCustomizerProps) {
  const [features, setFeatures] = useState<AvatarFeatures>(initialFeatures);
  const [imageUrl, setImageUrl] = useState<string>(generateDiceBearUrl(features, size));
  const [isGenerating, setIsGenerating] = useState(false);

  const updateFeature = useCallback(<K extends keyof AvatarFeatures>(key: K, value: AvatarFeatures[K]) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRandomize = useCallback(() => {
    setIsGenerating(true);
    const randomFeatures = {
      ...features,
      faceShape: AVATAR_OPTIONS.faceShape[Math.floor(Math.random() * AVATAR_OPTIONS.faceShape.length)],
      eyes: AVATAR_OPTIONS.eyes[Math.floor(Math.random() * AVATAR_OPTIONS.eyes.length)],
      eyebrows: AVATAR_OPTIONS.eyebrows[Math.floor(Math.random() * AVATAR_OPTIONS.eyebrows.length)],
      nose: AVATAR_OPTIONS.nose[Math.floor(Math.random() * AVATAR_OPTIONS.nose.length)],
      mouth: AVATAR_OPTIONS.mouth[Math.floor(Math.random() * AVATAR_OPTIONS.mouth.length)],
      hair: AVATAR_OPTIONS.hair[Math.floor(Math.random() * AVATAR_OPTIONS.hair.length)],
      hairColor: AVATAR_OPTIONS.hairColor[Math.floor(Math.random() * AVATAR_OPTIONS.hairColor.length)],
      skinColor: AVATAR_OPTIONS.skinColor[Math.floor(Math.random() * AVATAR_OPTIONS.skinColor.length)],
      eyeColor: AVATAR_OPTIONS.eyeColor[Math.floor(Math.random() * AVATAR_OPTIONS.eyeColor.length)],
      accessories: [],
      facialHair: AVATAR_OPTIONS.facialHair[Math.floor(Math.random() * AVATAR_OPTIONS.facialHair.length)],
    };
    setFeatures(randomFeatures);
    setTimeout(() => setIsGenerating(false), 100);
  }, [features]);

  const handleSave = useCallback(() => {
    const url = generateDiceBearUrl(features, size);
    setImageUrl(url);
    onSave(features, url);
  }, [features, onSave, size]);

  useEffect(() => {
    const url = generateDiceBearUrl(features, size);
    setImageUrl(url);
  }, [features, size]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="relative">
          <img
            src={imageUrl}
            alt="Avatar preview"
            className="rounded-2xl shadow-xl"
            style={{ width: size, height: size }}
          />
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(AVATAR_OPTIONS).map(([key, options]) => {
          const featureKey = key as keyof AvatarFeatures;
          const currentValue = features[featureKey];
          const isArray = Array.isArray(currentValue);

          if (isArray) return null;

          return (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateFeature(featureKey, option as AvatarFeatures[typeof featureKey])}
                    className={cnUtil(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      currentValue === option
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={handleRandomize} className="flex-1">
          Randomize
        </Button>
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex-1" disabled={isGenerating}>
          Save Avatar
        </Button>
      </div>
    </div>
  );
}

import { useEffect } from 'react';