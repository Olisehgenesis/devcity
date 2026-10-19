'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bell, CalendarDays, Check, ImagePlus, Shuffle, Wallet, X } from 'lucide-react';
import { Sheet } from './Sheet';
import type { SelfLegacyQrConfig } from './SelfLegacyQr';
import { clearSelfCheck, rememberSelfCheck, selfCheckPending } from '../lib/self-check';
import { DevTestAccountPanel } from './DevTestAccountPanel';
import { Button } from '@/components/ui/button';
import { BrandLoader } from './BrandLoader';
import { useCityStore, timeAgo, type AvatarMode } from '../lib/city-store';
import { dicebearAvatarUrl } from '../lib/avatars';
import { normalizeUsername } from '@/lib/usernames';
import { authClient } from '@/lib/auth-client';
import { clearUnlockedWallet } from '@/lib/unlocked-wallet';

const SelfLegacyQr = dynamic(() => import('./SelfLegacyQr').then((mod) => mod.SelfLegacyQr), { ssr: false });

interface YouSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
}

type ProfileUser = { id: string; name?: string | null; email?: string | null; username?: string | null };

function profileHandle(user: ProfileUser): string | null {
  const fromEmail = user.email?.toLowerCase().endsWith('@test.devcity.local')
    ? user.email.split('@')[0]
    : '';
  return normalizeUsername(user.username ?? '')
    || normalizeUsername(user.name ?? '')
    || normalizeUsername(fromEmail);
}

function formatEventDate(date: string | null) {
  if (!date) return 'Date to be announced';
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? 'Date to be announced'
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
        {mode === 'dicebear' && <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={shuffle} aria-label="Shuffle avatar" title="Shuffle avatar"><Shuffle size={16} /></Button>}
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

export function YouSheet({ open, onClose, onOpenWallet, onOpenNotifications }: YouSheetProps) {
  const activity = useCityStore((s) => s.activity);
  const savedEvents = useCityStore((s) => s.savedEvents);
  const markEventAttended = useCityStore((s) => s.markEventAttended);
  const removeSavedEvent = useCityStore((s) => s.removeSavedEvent);
  const avatarMode = useCityStore((s) => s.avatarMode);
  const avatarSeed = useCityStore((s) => s.avatarSeed);
  const avatarImageData = useCityStore((s) => s.avatarImageData);
  const setAvatarMode = useCityStore((s) => s.setAvatarMode);
  const setAvatarImageData = useCityStore((s) => s.setAvatarImageData);
  const shuffleAvatar = useCityStore((s) => s.shuffleAvatar);

  const [sessionUser, setSessionUser] = useState<ProfileUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [retrySession, setRetrySession] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifyConfigured, setVerifyConfigured] = useState(false);
  const [verifyCallback, setVerifyCallback] = useState('/api/webhooks/self');
  const [verifyMode, setVerifyMode] = useState<'test' | 'live'>('test');
  const [verifyError, setVerifyError] = useState('');
  const [startingVerify, setStartingVerify] = useState(false);
  const [selfQr, setSelfQr] = useState<SelfLegacyQrConfig | null>(null);
  const accountHandle = sessionUser ? profileHandle(sessionUser) : null;
  const profileName = accountHandle ? `${accountHandle}.devcity.fun` : sessionUser?.name || 'Your profile';
  const profileInitials = (accountHandle || sessionUser?.name || sessionUser?.email || 'You').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSessionLoading(true);
    setSessionError('');
    setSessionUser(null);
    void authClient.getSession()
      .then((result) => {
        if (active) setSessionUser((result?.data as { user?: ProfileUser } | null)?.user ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Could not load profile session:', error);
        setSessionError('Could not load your profile. Try again.');
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => { active = false; };
  }, [open, retrySession]);

  useEffect(() => {
    if (!open || !sessionUser) return;
    let active = true;
    void fetch('/api/me/verification')
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as {
          verified?: boolean;
          configured?: boolean;
          missing?: string[];
          callbackPath?: string;
          mode?: 'test' | 'live';
        };
        if (!active || !response.ok) return;
        setVerified(Boolean(body.verified));
        setVerifyConfigured(Boolean(body.configured));
        setVerifyCallback(body.callbackPath || '/api/webhooks/self');
        setVerifyMode(body.mode === 'live' ? 'live' : 'test');
      })
      .catch(() => {
        if (active) setVerifyError('Could not load verification.');
      });
    return () => { active = false; };
  }, [open, sessionUser]);

  useEffect(() => {
    if (!open || !sessionUser || verified) return;
    const returning = new URLSearchParams(window.location.search).get('self') === 'done' || selfCheckPending();
    if (!returning && !selfQr) return;
    let active = true;
    const look = () => {
      void fetch('/api/me/verification')
        .then(async (response) => {
          const body = await response.json().catch(() => ({})) as { verified?: boolean };
          if (!active || !response.ok || !body.verified) return;
          setVerified(true);
          setSelfQr(null);
          clearSelfCheck();
          const url = new URL(window.location.href);
          url.searchParams.delete('self');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        })
        .catch(() => {});
    };
    look();
    const timer = window.setInterval(look, 2000);
    const onVisible = () => { if (document.visibilityState === 'visible') look(); };
    document.addEventListener('visibilitychange', onVisible);
    const stop = window.setTimeout(() => window.clearInterval(timer), 40000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(stop);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, sessionUser, verified, selfQr]);

  async function startVerification() {
    setStartingVerify(true);
    setVerifyError('');
    try {
      const response = await fetch('/api/me/verification', { method: 'POST' });
      const body = await response.json().catch(() => ({})) as {
        error?: string;
        missing?: string[];
        callbackPath?: string;
        endpoint?: string;
        appName?: string;
        scope?: string;
        endpointType?: 'https' | 'staging_https';
        userId?: string;
        userDefinedData?: string;
        logo?: string;
        returnUrl?: string;
        verified?: boolean;
      };
      if (body.verified) {
        setVerified(true);
        setSelfQr(null);
        clearSelfCheck();
        return;
      }
      if (body.callbackPath) setVerifyCallback(body.callbackPath);
      if (!response.ok || !body.userDefinedData || !body.userId || !body.endpoint || !body.scope || !body.endpointType || !body.logo || !body.returnUrl) {
        setVerifyConfigured(false);
        setSelfQr(null);
        throw new Error(body.error || 'Self can only send proofs to a public https address.');
      }
      rememberSelfCheck();
      setSelfQr({
        appName: body.appName || 'DEVCITY',
        scope: body.scope,
        endpoint: body.endpoint,
        endpointType: body.endpointType,
        userId: body.userId,
        userDefinedData: body.userDefinedData,
        logo: body.logo,
        returnUrl: body.returnUrl,
      });
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : 'Verification is not configured.');
    } finally {
      setStartingVerify(false);
    }
  }

  useEffect(() => {
    const onSession = () => setRetrySession((attempt) => attempt + 1);
    window.addEventListener('devcity-session-changed', onSession);
    return () => window.removeEventListener('devcity-session-changed', onSession);
  }, []);

  async function signOut() {
    setSigningOut(true);
    setSessionError('');
    try {
      await authClient.signOut();
      clearUnlockedWallet();
      window.dispatchEvent(new Event('devcity-session-changed'));
      setSessionUser(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Profile" size="page">
      {sessionLoading ? (
        <div className="brand-loader-page">
          <BrandLoader label="Loading your profile…" />
        </div>
      ) : !sessionUser ? (
        <div className="profile-auth-gate">
          <img className="app-art" src="/assets/app/key.svg" alt="" width={104} height={78} />
          <div className="profile-gate-copy">
            <span className="profile-gate-kicker">YOUR DEVCITY ACCOUNT</span>
            <h3>Your profile starts here</h3>
            <p>Sign in to see your DEVCITY identity and activity.</p>
          </div>
          {sessionError && (
            <div className="profile-session-error" role="alert">
              <p>{sessionError}</p>
              <Button type="button" variant="outline" onClick={() => setRetrySession((attempt) => attempt + 1)}>Try again</Button>
            </div>
          )}
          <Button type="button" onClick={onOpenWallet}><Wallet size={17} /> Open wallet to sign in</Button>
          <DevTestAccountPanel onChanged={() => setRetrySession((attempt) => attempt + 1)} />
        </div>
      ) : (
        <div className="you-profile">
          <header className="profile-hero">
            <div className={`you-avatar you-avatar-lg${avatarMode === 'initials' ? ' you-avatar-initials' : ''}`}>
              {avatarMode === 'upload' && avatarImageData ? (
                <img src={avatarImageData} alt="Your uploaded profile photo" />
              ) : avatarMode === 'dicebear' ? (
                <img src={dicebearAvatarUrl(avatarSeed || sessionUser.name || sessionUser.id)} alt="Your generated avatar" />
              ) : <span>{profileInitials}</span>}
            </div>
            <div className="you-identity-text">
              <strong className="profile-display-name">{profileName}</strong>
              <span className="profile-account-label">{sessionUser.email?.endsWith('@test.devcity.local') ? 'Test account' : 'Here for the city.'}</span>
              {verified && <span className="profile-verified"><Check size={14} /> Verified</span>}
            </div>
            <Button type="button" variant="outline" onClick={() => document.querySelector<HTMLDetailsElement>('.profile-appearance-disclosure')?.setAttribute('open', '')}>Edit look</Button>
          </header>
          {verified && <p className="profile-verify-note">You verify once. This account keeps that check.</p>}
          {!verified && verifyConfigured && (
            <Button type="button" onClick={() => void startVerification()} disabled={startingVerify}>
              {startingVerify ? 'Preparing Self…' : 'Get verified'}
            </Button>
          )}
          {!verified && !verifyConfigured && (
            <p className="profile-verify-note">Self sends the proof to {verifyCallback}. It needs the public address https://devcity.fun/api/webhooks/self.</p>
          )}
          {verifyError && <p className="avatar-upload-error" role="alert">{verifyError}</p>}
          {selfQr && !verified && (
            <SelfLegacyQr config={selfQr} onVerified={() => {
              void fetch('/api/me/verification')
                .then(async (response) => {
                  const body = await response.json().catch(() => ({})) as { verified?: boolean };
                  if (response.ok && body.verified) {
                    setVerified(true);
                    setSelfQr(null);
                    clearSelfCheck();
                  }
                })
                .catch(() => undefined);
            }} />
          )}

          <div className="profile-stat-strip" aria-label="Your DEVCITY activity">
            <div><strong>{savedEvents.filter((event) => event.attendance === 'attended').length}</strong><span>attended</span></div>
            <div><strong>{activity.filter((item) => item.kind === 'claim').length}</strong><span>drops</span></div>
            <div><strong>{activity.filter((item) => item.kind === 'tip').length}</strong><span>tips</span></div>
          </div>

          <section className="profile-events-section" aria-labelledby="profile-events-title">
            <div className="profile-section-heading">
              <div><span className="profile-section-kicker">YOUR CITY CALENDAR</span><h3 id="profile-events-title">My events</h3></div>
              <span className="profile-count">{savedEvents.length}</span>
            </div>
            <p className="profile-device-note">Your going and attended list is saved on this device.</p>
            {savedEvents.length > 0 ? (
              <div className="profile-event-list">
                {savedEvents.map((event) => (
                  <article className="profile-event-item" key={event.id}>
                    <span className={`profile-event-state${event.attendance === 'attended' ? ' is-attended' : ''}`}>
                      {event.attendance === 'attended' ? <Check size={14} /> : <CalendarDays size={14} />}
                    </span>
                    <div className="profile-event-copy">
                      <strong>{event.name}</strong>
                      <span>{formatEventDate(event.startDate)}{event.location ? ` · ${event.location}` : ''}</span>
                      <small>{event.attendance === 'attended' ? 'Attended' : 'Going'}</small>
                    </div>
                    <div className="profile-event-actions">
                      {event.attendance === 'going' && <Button type="button" onClick={() => markEventAttended(event.id)}>Attended</Button>}
                      {event.url && (
                        <Button asChild variant="outline">
                          <a href={event.url} target="_blank" rel="noreferrer" aria-label={`Open ${event.name}`}>Open</a>
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => removeSavedEvent(event.id)} aria-label={`Remove ${event.name} from my events`}><X size={14} /></Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="profile-empty-events">
                <p>Keep your plans and past events together here.</p>
                <span>Open an event on the map and choose “I’m going” to add it.</span>
              </div>
            )}
          </section>

          <details className="profile-disclosure profile-appearance-disclosure">
            <summary>Profile appearance <span>Saved on this device</span></summary>
            <AvatarControls mode={avatarMode} seed={avatarSeed} fallbackSeed={sessionUser.name ?? 'you'} imageData={avatarImageData} setMode={setAvatarMode} setImageData={setAvatarImageData} shuffle={shuffleAvatar} />
          </details>

          <details className="profile-disclosure">
            <summary>City activity <span>{activity.length}</span></summary>
            <div className="profile-activity-wrap">
              {activity.length > 0 ? (
                <>
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
                </>
              ) : (
                <div className="profile-empty-activity">
                  <p>Your drops and tips will show up here as you explore.</p>
                </div>
              )}
            </div>
          </details>

          <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left" onClick={onOpenNotifications}>
            <Bell size={18} />
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <strong>Notifications</strong>
              <small className="text-xs font-medium">Replies, follows, and drops</small>
            </span>
          </Button>
          <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left" onClick={onOpenWallet}>
            <Wallet size={18} />
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <strong>Open wallet</strong>
              <small className="text-xs font-medium">Balances, address and security</small>
            </span>
            <span aria-hidden="true">→</span>
          </Button>
          <Button type="button" variant="outline" disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
