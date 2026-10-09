'use client';

import { useEffect, useRef, useState } from 'react';
import { Gift, ImagePlus, Shuffle } from 'lucide-react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { Sheet } from './Sheet';
import { useCityStore, timeAgo, type AvatarMode, type PresenceStatus, type Visibility } from '../lib/city-store';
import { dicebearAvatarUrl } from '../lib/avatars';

interface YouSheetProps {
  open: boolean;
  onClose: () => void;
  notify: (msg: string) => void;
}

const VISIBILITY_OPTIONS: { id: Visibility; label: string; hint: string }[] = [
  { id: 'invisible', label: 'Off map', hint: 'Your profile stays available, but not your presence' },
  { id: 'event-only', label: 'Event only', hint: 'Shown only in events you join, approximately' },
  { id: 'approximate', label: 'Around me', hint: 'A coarse area, never your exact location' },
  { id: 'visible', label: 'City visible', hint: 'Discoverable across Mumbai, still approximate' },
];

const PRESENCE_DURATIONS = [
  { id: '1h', label: '1 hour', milliseconds: 60 * 60 * 1000 },
  { id: '8h', label: '8 hours', milliseconds: 8 * 60 * 60 * 1000 },
  { id: 'always', label: 'Until I change it', milliseconds: null },
] as const;

function PrivacyAndPresenceControls({
  profilePrivacy,
  setProfilePrivacy,
  visibility,
  setVisibility,
  presenceStatus,
  presenceUntil,
  presenceDuration,
  setPresenceDuration,
  setPresence,
}: {
  profilePrivacy: 'public' | 'private';
  setProfilePrivacy: (privacy: 'public' | 'private') => void;
  visibility: Visibility;
  setVisibility: (visibility: Visibility) => void;
  presenceStatus: PresenceStatus;
  presenceUntil: number | null;
  presenceDuration: (typeof PRESENCE_DURATIONS)[number]['id'];
  setPresenceDuration: (duration: (typeof PRESENCE_DURATIONS)[number]['id']) => void;
  setPresence: (status: PresenceStatus, durationMs?: number | null) => void;
}) {
  return (
    <>
      <div className="you-section">
        <h3 className="you-section-title">Profile privacy</h3>
        <p className="profile-control-hint">Choose who can discover your city profile.</p>
        <div className="privacy-switch" role="group" aria-label="Profile privacy">
          <button className={profilePrivacy === 'public' ? 'is-selected' : ''} onClick={() => setProfilePrivacy('public')}>Public</button>
          <button className={profilePrivacy === 'private' ? 'is-selected' : ''} onClick={() => setProfilePrivacy('private')}>Private</button>
        </div>
      </div>
      <div className="you-section">
        <h3 className="you-section-title">Map presence</h3>
        <p className="profile-control-hint">Your precise location is never shown to anyone.</p>
        <div className="you-visibility">
          {VISIBILITY_OPTIONS.map((option) => (
            <button key={option.id} className={`you-visibility-option${visibility === option.id ? ' is-selected' : ''}`} onClick={() => setVisibility(option.id)}>
              <span className="you-visibility-label">{option.label}</span>
              <span className="you-visibility-hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="you-section">
        <div className="presence-heading">
          <div><h3 className="you-section-title">Online status</h3><p className="profile-control-hint">{presenceUntil ? `Status expires in ${Math.max(1, Math.ceil((presenceUntil - Date.now()) / (60 * 60 * 1000)))}h` : 'Set when people can see you active.'}</p></div>
          <span className={`presence-indicator presence-${presenceStatus}`}><i />{presenceStatus}</span>
        </div>
        <div className="presence-switch" role="group" aria-label="Online status">
          {(['online', 'away', 'offline'] as PresenceStatus[]).map((status) => {
            const duration = PRESENCE_DURATIONS.find((item) => item.id === presenceDuration)!;
            return <button key={status} className={presenceStatus === status ? `is-selected is-${status}` : ''} onClick={() => setPresence(status, status === 'online' ? null : duration.milliseconds)}>{status}</button>;
          })}
        </div>
        {presenceStatus !== 'online' && <div className="presence-duration" role="group" aria-label="Status duration">
          {PRESENCE_DURATIONS.map((duration) => <button key={duration.id} className={presenceDuration === duration.id ? 'is-selected' : ''} onClick={() => { setPresenceDuration(duration.id); setPresence(presenceStatus, duration.milliseconds); }}>{duration.label}</button>)}
        </div>}
      </div>
    </>
  );
}

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
  const { address, isConnected, chainId, isConnecting } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const claimed = useCityStore((s) => s.claimed);
  const tips = useCityStore((s) => s.tips);
  const activity = useCityStore((s) => s.activity);
  const visibility = useCityStore((s) => s.visibility);
  const setVisibility = useCityStore((s) => s.setVisibility);
  const profilePrivacy = useCityStore((s) => s.profilePrivacy);
  const setProfilePrivacy = useCityStore((s) => s.setProfilePrivacy);
  const presenceStatus = useCityStore((s) => s.presenceStatus);
  const presenceUntil = useCityStore((s) => s.presenceUntil);
  const setPresence = useCityStore((s) => s.setPresence);
  const avatarMode = useCityStore((s) => s.avatarMode);
  const avatarSeed = useCityStore((s) => s.avatarSeed);
  const avatarImageData = useCityStore((s) => s.avatarImageData);
  const setAvatarMode = useCityStore((s) => s.setAvatarMode);
  const setAvatarImageData = useCityStore((s) => s.setAvatarImageData);
  const shuffleAvatar = useCityStore((s) => s.shuffleAvatar);

  const [copied, setCopied] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [presenceDuration, setPresenceDuration] = useState<(typeof PRESENCE_DURATIONS)[number]['id']>('8h');

  useEffect(() => {
    if (!presenceUntil) return;
    const remaining = presenceUntil - Date.now();
    if (remaining <= 0) {
      setPresence('online');
      return;
    }
    const timer = window.setTimeout(() => setPresence('online'), remaining);
    return () => window.clearTimeout(timer);
  }, [presenceUntil, setPresence]);

  const coinbase = connectors.find((c) => /coinbase/i.test(c.id + c.name));
  const injected = connectors.find((c) => c.type === 'injected' || /metamask|browser/i.test(c.name));
  const fallback = connectors.find((c) => c !== coinbase && c !== injected);

  const wrongChain = isConnected && chainId !== baseSepolia.id && chainId !== base.id;
  const claimCount = Object.keys(claimed).length;

  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected && open && !wasConnected.current) {
      notify('Wallet connected. You are in the city.');
      onClose();
    }
    wasConnected.current = isConnected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, open]);

  const doConnect = async (id: string) => {
    const connector = connectors.find((c) => c.id === id);
    if (!connector) return;
    setPendingId(id);
    try {
      await connect({ connector });
    } catch {
      /* surfaced via wagmi error state below */
    } finally {
      setPendingId(null);
    }
  };

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
    <Sheet open={open} onClose={onClose} eyebrow="Profile" title={isConnected ? 'You' : 'Enter the city'}>
      {!isConnected ? (
        <div className="you-connect">
          <div className="you-identity avatar-onboarding-identity">
            <div className={`you-avatar you-avatar-lg${avatarMode === 'initials' ? ' you-avatar-initials' : ''}`}>
              {avatarMode === 'upload' && avatarImageData
                ? <img src={avatarImageData} alt="Your uploaded profile photo" />
                : avatarMode === 'dicebear' && avatarSeed
                  ? <img src={dicebearAvatarUrl(avatarSeed)} alt="Your generated avatar" />
                  : <span>YOU</span>}
            </div>
            <div className="you-identity-text"><strong>Your city avatar</strong><span>Change it any time.</span></div>
          </div>
          <AvatarControls mode={avatarMode} seed={avatarSeed} fallbackSeed="you" imageData={avatarImageData} setMode={setAvatarMode} setImageData={setAvatarImageData} shuffle={shuffleAvatar} />
          <PrivacyAndPresenceControls profilePrivacy={profilePrivacy} setProfilePrivacy={setProfilePrivacy} visibility={visibility} setVisibility={setVisibility} presenceStatus={presenceStatus} presenceUntil={presenceUntil} presenceDuration={presenceDuration} setPresenceDuration={setPresenceDuration} setPresence={setPresence} />
          <p className="you-lede">
            Claim drops, tip builders, and show up on the map. Passkey-first — no seed phrase.
          </p>

          <div className="you-connect-buttons">
            {coinbase && (
              <button
                className="you-connect-primary"
                disabled={isPending || isConnecting}
                onClick={() => doConnect(coinbase.id)}
              >
                {pendingId === coinbase.id || isConnecting ? (
                  <><span className="spinner" /> Connecting…</>
                ) : (
                  'Continue with passkey'
                )}
              </button>
            )}
            {injected && (
              <button
                className="you-connect-secondary"
                disabled={isPending || isConnecting}
                onClick={() => doConnect(injected.id)}
              >
                {pendingId === injected.id ? (
                  <><span className="spinner spinner-dark" /> Connecting…</>
                ) : (
                  'Browser wallet'
                )}
              </button>
            )}
            {fallback && !coinbase && !injected && (
              <button
                className="you-connect-primary"
                disabled={isPending || isConnecting}
                onClick={() => doConnect(fallback.id)}
              >
                Connect wallet
              </button>
            )}
          </div>

          {error && <p className="you-error">{error.message.split('.')[0]}</p>}
          <p className="you-note">
            {isConnecting || pendingId
              ? 'Check the Coinbase window to finish sign-in.'
              : 'Base Sepolia · gasless claims · demo until contracts deploy'}
          </p>
        </div>
      ) : (
        <div className="you-profile">
          <div className="you-identity">
            <div className={`you-avatar you-avatar-lg${avatarMode === 'initials' ? ' you-avatar-initials' : ''}`}>
              {avatarMode === 'upload' && avatarImageData ? (
                <img src={avatarImageData} alt="Your uploaded profile photo" />
              ) : avatarMode === 'dicebear' && avatarSeed ? (
                <img src={dicebearAvatarUrl(avatarSeed)} alt="Your generated avatar" />
              ) : (
                <span>{address!.slice(2, 4).toUpperCase()}</span>
              )}
            </div>
            <div className="you-identity-text">
              <button className="you-address" onClick={copyAddr}>
                {shortAddr(address)} {copied ? '· copied' : ''}
              </button>
              <span className="you-chain">
                {chainId === base.id ? 'Base' : chainId === baseSepolia.id ? 'Base Sepolia' : 'Wrong network'}
              </span>
            </div>
          </div>

          <AvatarControls mode={avatarMode} seed={avatarSeed} fallbackSeed={address?.slice(2, 4) ?? 'you'} imageData={avatarImageData} setMode={setAvatarMode} setImageData={setAvatarImageData} shuffle={shuffleAvatar} />

          {wrongChain && (
            <button className="you-switch" onClick={() => switchChain({ chainId: baseSepolia.id })}>
              Switch to Base Sepolia
            </button>
          )}

          <div className="you-stats">
            <div className="you-stat">
              <strong>{claimCount}</strong>
              <span>claimed</span>
            </div>
            <div className="you-stat">
              <strong>{tips.length}</strong>
              <span>tips sent</span>
            </div>
            <div className="you-stat">
              <strong>{VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.label}</strong>
              <span>map visibility</span>
            </div>
          </div>

          <div className="you-section">
            <h3 className="you-section-title">Your tokens</h3>
            {claimCount === 0 ? (
              <p className="you-empty">No tokens yet — claim a drop on the map.</p>
            ) : (
              <ul className="you-tokens">
                {Object.values(claimed).map((c) => (
                  <li key={c.dropId}>
                    <span className="you-token-icon">
                      <Gift size={14} />
                    </span>
                    <span className="you-token-name">{c.dropName || c.dropId}</span>
                    <strong>
                      {c.amount} {c.tokenSymbol}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <PrivacyAndPresenceControls profilePrivacy={profilePrivacy} setProfilePrivacy={setProfilePrivacy} visibility={visibility} setVisibility={setVisibility} presenceStatus={presenceStatus} presenceUntil={presenceUntil} presenceDuration={presenceDuration} setPresenceDuration={setPresenceDuration} setPresence={setPresence} />

          <div className="you-section">
            <h3 className="you-section-title">Activity</h3>
            {activity.length === 0 ? (
              <p className="you-empty">Nothing yet — claim a drop to start your trail.</p>
            ) : (
              <ul className="you-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className={`you-activity-dot you-activity-${item.kind}`} />
                    <span className="you-activity-text">{item.text}</span>
                    <span className="you-activity-time">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            className="you-disconnect"
            onClick={() => {
              disconnect();
              notify('Wallet disconnected.');
              onClose();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </Sheet>
  );
}
