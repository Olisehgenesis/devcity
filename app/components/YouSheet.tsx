'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Shuffle } from 'lucide-react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { Sheet } from './Sheet';
import { useCityStore, timeAgo, type AvatarMode } from '../lib/city-store';
import { dicebearAvatarUrl } from '../lib/avatars';
import { PasskeyWallet } from './PasskeyWallet';

interface YouSheetProps {
  open: boolean;
  onClose: () => void;
  notify: (msg: string) => void;
}

type ProfileUser = { id: string; name?: string | null; email?: string | null };

function shortAddr(addr?: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function encodeProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process the image.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = canvas.toDataURL('image/webp', 0.88);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88);
}

function AvatarControls({
  mode,
  seed,
  fallbackSeed,
  imageData,
  setMode,
  setImageData,
  shuffle,
}: {
  mode: 'dicebear' | 'initials' | 'upload';
  seed: string;
  fallbackSeed: string;
  imageData: string | null;
  setMode: (mode: AvatarMode) => void;
  setImageData: (data: string) => void;
  shuffle: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setUploadError('');
      setImageData(await encodeProfileImage(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not use this image.');
    }
  }

  return (
    <div className="you-section avatar-settings">
      <div className="avatar-settings-heading">
        <div><h3 className="you-section-title">Your look</h3><p>Choose how you show up in the city.</p></div>
        {mode === 'dicebear' && <button className="avatar-shuffle" onClick={shuffle} aria-label="Shuffle avatar" title="Shuffle avatar"><Shuffle size={16} /></button>}
      </div>
      <div className="avatar-choice" role="group" aria-label="Avatar style">
        <button className={mode === 'dicebear' ? 'is-selected' : ''} onClick={() => { setMode('dicebear'); if (!seed) shuffle(); }}>
          <span className="avatar-choice-preview"><img src={dicebearAvatarUrl(seed || fallbackSeed)} alt="" /></span>
          DiceBear
        </button>
        <button className={mode === 'upload' ? 'is-selected' : ''} onClick={() => fileInput.current?.click()}>
          <span className="avatar-choice-preview avatar-choice-upload">{imageData ? <img src={imageData} alt="" /> : <ImagePlus size={17} />}</span>
          Upload
        </button>
        <button className={mode === 'initials' ? 'is-selected' : ''} onClick={() => setMode('initials')}>
          <span className="avatar-choice-preview avatar-choice-monogram">{fallbackSeed.slice(0, 2).toUpperCase()}</span>
          Initials
        </button>
      </div>
      <input ref={fileInput} className="avatar-file-input" type="file" accept="image/*" onChange={handleFileChange} aria-label="Upload profile photo" />
      {uploadError && <p className="avatar-upload-error" role="alert">{uploadError}</p>}
    </div>
  );
}

export function YouSheet({ open, onClose, notify }: YouSheetProps) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const activity = useCityStore((s) => s.activity);
  const avatarMode = useCityStore((s) => s.avatarMode);
  const avatarSeed = useCityStore((s) => s.avatarSeed);
  const avatarImageData = useCityStore((s) => s.avatarImageData);
  const setAvatarMode = useCityStore((s) => s.setAvatarMode);
  const setAvatarImageData = useCityStore((s) => s.setAvatarImageData);
  const shuffleAvatar = useCityStore((s) => s.shuffleAvatar);

  const [copied, setCopied] = useState(false);
  const [sessionUser, setSessionUser] = useState<ProfileUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const wrongChain = isConnected && chainId !== baseSepolia.id && chainId !== base.id;
  const profileName = sessionUser?.name || 'City explorer';
  const profileInitials = (sessionUser?.name || sessionUser?.email || 'You').slice(0, 2).toUpperCase();
  const chainLabel = !isConnected
    ? 'Verified with passkey'
    : chainId === base.id
      ? 'Base'
      : chainId === baseSepolia.id
        ? 'Base Sepolia'
        : 'Wrong network';

  const copyAddr = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Your account" title={sessionUser ? 'Your profile' : 'Sign in'}>
      {!sessionUser ? (
        <div className="profile-auth-gate">
          <div className="profile-gate-art"><span><ImagePlus size={25} /></span><i /><i /><i /></div>
          <div className="profile-gate-copy">
            <h3>{sessionLoading ? 'Checking your account' : 'Your city, your account'}</h3>
            <p>{sessionLoading ? 'One moment while we check your passkey session.' : 'Sign in to view your profile, wallet, and activity.'}</p>
          </div>
          <PasskeyWallet
            onSessionChange={(user) => setSessionUser(user)}
            onSessionReady={() => setSessionLoading(false)}
          />
        </div>
      ) : (
        <div className="you-profile">
          <header className="profile-hero">
            <div className={`you-avatar you-avatar-lg${avatarMode === 'initials' ? ' you-avatar-initials' : ''}`}>
              {avatarMode === 'upload' && avatarImageData ? (
                <img src={avatarImageData} alt="Your uploaded profile photo" />
              ) : avatarMode === 'dicebear' && avatarSeed ? (
                <img src={dicebearAvatarUrl(avatarSeed)} alt="Your generated avatar" />
              ) : <span>{profileInitials}</span>}
            </div>
            <div className="you-identity-text">
              <strong className="profile-display-name">{profileName}</strong>
              {address ? <button className="you-address" onClick={copyAddr}>{shortAddr(address)} {copied ? '· copied' : ''}</button> : <span className="profile-account-label">{sessionUser.email || 'Passkey account'}</span>}
              <span className="you-chain">{chainLabel}</span>
            </div>
          </header>

          {wrongChain && (
            <button className="you-switch" onClick={() => switchChain({ chainId: baseSepolia.id })}>
              Switch to Base Sepolia
            </button>
          )}

          <details className="profile-disclosure">
            <summary>Profile appearance <span>Saved on this device</span></summary>
            <AvatarControls mode={avatarMode} seed={avatarSeed} fallbackSeed={address?.slice(2, 4) ?? sessionUser.name ?? 'you'} imageData={avatarImageData} setMode={setAvatarMode} setImageData={setAvatarImageData} shuffle={shuffleAvatar} />
          </details>

          {activity.length > 0 && <details className="profile-disclosure">
            <summary>Recent activity <span>{activity.length}</span></summary>
            <div className="profile-activity-wrap">
              <ul className="you-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className={`you-activity-dot you-activity-${item.kind}`} />
                    <span className="you-activity-text">{item.text}</span>
                    <span className="you-activity-time">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
              <p className="profile-local-note">Activity is stored on this device.</p>
            </div>
          </details>}

          <details className="profile-disclosure profile-wallet-disclosure">
            <summary>Wallet, balances & recovery <span>Manage</span></summary>
            <PasskeyWallet
              onSessionChange={(user) => setSessionUser(user)}
              onSessionReady={() => setSessionLoading(false)}
            />
          </details>

          {isConnected && <button className="you-disconnect" onClick={() => { disconnect(); notify('Browser wallet disconnected.'); }}>
            Disconnect browser wallet
          </button>}
        </div>
      )}
    </Sheet>
  );
}
