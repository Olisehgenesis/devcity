'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { AvatarDisplay } from '@/components/avatar/AvatarComponents';
import { useAppStore } from '@/lib/store';
import { generateDiceBearUrl, generateRandomFeatures } from '@/lib/avatar';
import type { AvatarMode } from '@/types';

const MODES: { value: AvatarMode; label: string; hint: string }[] = [
  { value: 'dicebear', label: 'Dicebear', hint: 'Generated from a seed' },
  { value: 'initials', label: 'Initials', hint: 'Your initials on a colored tile' },
  { value: 'upload', label: 'Upload', hint: 'Your own image' },
];

export function AvatarPicker() {
  const {
    user,
    avatarMode,
    avatarSeed,
    avatarImageData,
    setAvatarMode,
    setAvatarSeed,
    setAvatarImageData,
    updateMe,
    setActiveBottomSheet,
  } = useAppStore();

  const previewUrl = useMemo(() => {
    if (avatarMode === 'upload' && avatarImageData) return avatarImageData;
    if (avatarMode === 'initials') return undefined;
    const seed = avatarSeed || user?.username || user?.walletAddress || 'genesis';
    return generateDiceBearUrl(generateRandomFeatures(seed), 160);
  }, [avatarMode, avatarSeed, avatarImageData, user]);

  const handleShuffle = () => {
    const seed = `${user?.username || 'genesis'}-${Math.floor(Math.random() * 1000)}`;
    setAvatarSeed(seed);
    void updateAvatar({ avatarMode: 'dicebear', avatarSeed: seed });
  };

  const handleModeChange = (mode: AvatarMode) => {
    setAvatarMode(mode);
    void updateAvatar({ avatarMode: mode });
  };

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      setAvatarImageData(data);
      void updateAvatar({ avatarMode: 'upload', avatarImageData: data });
    };
    reader.readAsDataURL(file);
  };

  const updateAvatar = (updates: { avatarMode?: AvatarMode; avatarSeed?: string; avatarImageData?: string | null }) => {
    void updateMe({
      userAddress: user?.walletAddress || '',
      ...updates,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <AvatarDisplay
          src={previewUrl}
          name={user?.username}
          walletAddress={user?.walletAddress}
          size="xl"
        />
        <div className="flex-1">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{user?.username || 'You'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Choose how you appear in the city</p>
        </div>
        <Badge variant="gradient">Avatar</Badge>
      </div>

      <Separator />

      <div className="space-y-2">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => handleModeChange(mode.value)}
            className={cn(
              'w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all text-left',
              avatarMode === mode.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{mode.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{mode.hint}</p>
            </div>
            <span className={cn('h-4 w-4 rounded-full border-2', avatarMode === mode.value ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-600')} />
          </button>
        ))}
      </div>

      {avatarMode === 'dicebear' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Seed</p>
            <Button variant="outline" size="sm" onClick={handleShuffle}>
              Shuffle
            </Button>
          </div>
          <input
            value={avatarSeed}
            onChange={(e) => {
              setAvatarSeed(e.target.value);
              void updateAvatar({ avatarMode: 'dicebear', avatarSeed: e.target.value });
            }}
            placeholder="avatar seed"
            className="input-base"
          />
        </div>
      )}

      {avatarMode === 'upload' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e.target.files?.[0])}
              className="mt-1.5 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300 hover:file:bg-primary-100"
            />
          </label>
          {avatarImageData && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Image saved locally — syncs to your profile.</p>
          )}
        </div>
      )}

      <Separator />

      <Button className="w-full" onClick={() => setActiveBottomSheet('none')}>
        Done
      </Button>
    </div>
  );
}
