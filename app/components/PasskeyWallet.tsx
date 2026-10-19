'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { useBalance, useReadContract } from 'wagmi';
import { privateKeyToAccount } from 'viem/accounts';
import { authClient } from '@/lib/auth-client';
import { normalizeUsername } from '@/lib/usernames';
import { clearUnlockedWallet, getUnlockedPrivateKey, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import {
  createEOA,
  encryptWithPassphrase,
  saveLocalWallet,
  loadLocalWallet,
  bindWalletToUser,
  listLocalWallets,
  walletForUser,
  uploadEncryptedBackup,
  decryptWithPassphrase,
  loadBackupForUser,
  type LocalWallet,
} from '@/lib/keystore';
import { ACTIVE_CHAIN, CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, feeCurrenciesFor } from '@/lib/celo';
import { readFeePreference } from '@/lib/fee-preference';
import { PinBoxes } from './PinBoxes';
import { ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';
import { removeImportedWalletToken, type ImportedWalletToken } from '@/lib/wallet-assets';
import { WalletSwap, type SwapHolding } from './wallet/WalletSwap';
import { WalletHome } from './wallet/WalletHome';
import { WalletShell, type WalletNav } from './wallet/WalletShell';
import { WalletDashboard } from './wallet/WalletDashboard';
import { WalletCityTab } from './wallet/WalletCityTab';
import { WalletSendTab } from './wallet/WalletSendTab';
import { WalletTipTab } from './wallet/WalletTipTab';
import { WalletSettings } from './wallet/WalletSettings';
import { WalletReceive } from './wallet/WalletReceive';
import { WalletActivity } from './wallet/WalletActivity';
import { WalletTokenDetail } from './wallet/WalletTokenDetail';
import { WalletTokenTools } from './WalletTokenTools';
import { useCityStore } from '../lib/city-store';
import { dicebearAvatarUrl } from '../lib/avatars';
import type { HeldTokenView } from './wallet/types';
import { useProfileToken } from '../hooks/useProfileToken';
import { formatUsd, useUsdPrices } from '../hooks/useUsdPrices';

type Phase = 'signed-out' | 'registering' | 'ready' | 'restore' | 'backup-required';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

type WalletScreen =
  | { id: 'home' }
  | { id: 'send'; token?: string }
  | { id: 'tip' }
  | { id: 'receive'; symbol?: string }
  | { id: 'swap' }
  | { id: 'profile' }
  | { id: 'token'; token: HeldTokenView }
  | { id: 'settings' }
  | { id: 'activity' }
  | { id: 'drops' };

interface PasskeyWalletProps {
  onSessionChange?: (user: SessionUser | null) => void;
  onSessionReady?: () => void;
  onNotify?: (message: string) => void;
  onClose?: () => void;
  onCreateDrop?: () => void;
  browserWallet?: { address: string; onDisconnect: () => void } | null;
}

export function PasskeyWallet({ onSessionChange, onSessionReady, onNotify, onClose, onCreateDrop, browserWallet }: PasskeyWalletProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('signed-out');
  const [wallet, setWallet] = useState<LocalWallet | null>(null);
  const [unlockedKey, setUnlockedKey] = useState<Hex | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [authAction, setAuthAction] = useState<'sign-in' | 'register' | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [screen, setScreen] = useState<WalletScreen>({ id: 'home' });
  const [importSignal, setImportSignal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [restoreAddress, setRestoreAddress] = useState<string | null>(null);

  const [feeSymbol, setFeeSymbol] = useState('auto');
  const [importedTokens, setImportedTokens] = useState<ImportedWalletToken[]>([]);
  const onImportedTokensChange = useCallback((tokens: ImportedWalletToken[]) => setImportedTokens(tokens), []);

  const avatarMode = useCityStore((state) => state.avatarMode);
  const avatarSeed = useCityStore((state) => state.avatarSeed);
  const avatarImageData = useCityStore((state) => state.avatarImageData);
  const chainId = IS_MAINNET ? CELO_MAINNET_ID : CELO_SEPOLIA_ID;
  const chainLabel = IS_MAINNET ? 'Celo' : 'Celo Sepolia';
  const addr = wallet?.address;
  const fees = feeCurrenciesFor(chainId);

  useEffect(() => {
    const saved = readFeePreference();
    const allowed = saved === 'auto' || saved === 'CELO' || fees.some((fee) => fee.symbol === saved);
    setFeeSymbol(allowed ? saved : 'auto');
  }, [chainId, fees]);
  const handle = normalizeUsername(username) ?? normalizeUsername(user?.name ?? '') ?? 'city-explorer';

  useEffect(() => {
    if (!showSignup) return;
    const normalized = normalizeUsername(username);
    if (!username.trim()) {
      setUsernameStatus('idle');
      return;
    }
    if (!normalized) {
      setUsernameStatus('invalid');
      return;
    }

    const controller = new AbortController();
    setUsernameStatus('checking');
    const timer = window.setTimeout(() => {
      fetch(`/api/usernames/availability?username=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json() as { available?: boolean };
          if (!response.ok) throw new Error('Could not check username availability.');
          setUsernameStatus(data.available ? 'available' : 'taken');
        })
        .catch((availabilityError: unknown) => {
          if (availabilityError instanceof DOMException && availabilityError.name === 'AbortError') return;
          setUsernameStatus('error');
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [showSignup, username]);

  // ─── On-chain balances (read for the EOA, always called) ──────────────
  const { data: celoBalance, isError: celoError, refetch: refetchCelo } = useBalance({
    address: addr as Address,
    query: { enabled: !!addr, placeholderData: (previous) => previous },
  });
  const usdtBal = useReadContract({
    address: fees.find((f) => f.symbol === 'USDT')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr, placeholderData: (previous) => previous },
  });
  const usdcBal = useReadContract({
    address: fees.find((f) => f.symbol === 'USDC')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr, placeholderData: (previous) => previous },
  });
  const usdmBal = useReadContract({
    address: fees.find((f) => f.symbol === 'USDm')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr, placeholderData: (previous) => previous },
  });

  const stableBalances = useMemo(() => {
    const fmt = (raw: unknown, decimals: number) => raw == null ? null : Number(raw) / 10 ** decimals;
    return {
      USDT: fmt(usdtBal.data, 6),
      USDC: fmt(usdcBal.data, 6),
      USDm: fmt(usdmBal.data, 18),
    };
  }, [usdtBal.data, usdcBal.data, usdmBal.data]);
  const holdingStatus = {
    CELO: celoBalance ? 'ready' as const : celoError ? 'error' as const : 'loading' as const,
    USDT: usdtBal.data != null ? 'ready' as const : usdtBal.isError ? 'error' as const : 'loading' as const,
    USDC: usdcBal.data != null ? 'ready' as const : usdcBal.isError ? 'error' as const : 'loading' as const,
    USDm: usdmBal.data != null ? 'ready' as const : usdmBal.isError ? 'error' as const : 'loading' as const,
  };
  const retryHolding = (symbol: 'CELO' | 'USDT' | 'USDC' | 'USDm') => {
    if (symbol === 'CELO') void refetchCelo();
    if (symbol === 'USDT') void usdtBal.refetch();
    if (symbol === 'USDC') void usdcBal.refetch();
    if (symbol === 'USDm') void usdmBal.refetch();
  };

  const { token: profileToken, loading: profileLoading } = useProfileToken(wallet?.address);
  const usdPrices = useUsdPrices();
  async function refreshSession() {
    try {
      const res = await authClient.getSession();
      const next = (res?.data as { user?: SessionUser } | null)?.user ?? null;
      setUser(next);
      onSessionChange?.(next);
      if (next) {
        await resolveWalletForUser(next.id, next.name);
      } else {
        clearUnlockedWallet();
        setPhase('signed-out');
        setWallet(null);
        setUnlockedKey(null);
      }
    } catch (sessionError) {
      clearUnlockedWallet();
      setError(sessionError instanceof Error ? sessionError.message : 'Could not check your account.');
      setUser(null);
      onSessionChange?.(null);
      setPhase('signed-out');
      setWallet(null);
      setUnlockedKey(null);
    } finally {
      setSessionLoading(false);
      onSessionReady?.();
    }
  }

  useEffect(() => {
    void refreshSession();
    const onSession = () => { void refreshSession(); };
    window.addEventListener('devcity-session-changed', onSession);
    return () => window.removeEventListener('devcity-session-changed', onSession);
  }, []);

  // Reuse the already-unlocked key from this session so reopening the wallet
  // (or remounting) never re-prompts for the PIN just to view balances/tokens.
  // The PIN itself is never persisted — only the decrypted key in memory.
  useEffect(() => {
    if (!wallet?.address) return;
    const existing = getUnlockedPrivateKey(wallet.address);
    if (existing) setUnlockedKey(existing);
  }, [wallet?.address]);

  async function resolveWalletForUser(uid: string, username?: string | null) {
    const matched = await walletForUser(uid, username);
    if (matched) {
      const bound = await bindWalletToUser(matched, uid);
      setWallet(bound);
      if (unlockedKey && getUnlockedPrivateKey(bound.address) == null) setUnlockedKey(null);
      setPhase('ready');
      return;
    }

    clearUnlockedWallet();
    setWallet(null);
    setUnlockedKey(null);

    try {
      const backup = await loadBackupForUser(uid);
      if (backup) {
        const wallets = await listLocalWallets();
        const onDevice = wallets.find((item) => item.address.toLowerCase() === backup.address.toLowerCase());
        if (onDevice) {
          const bound = await bindWalletToUser(onDevice, uid);
          setWallet(bound);
          setPhase('ready');
          return;
        }
        setRestoreAddress(backup.address);
        setPhase('restore');
        return;
      }
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not check for a wallet backup.');
    }

    setPhase('registering');
    setError('');
  }

  async function leaveAccount() {
    try {
      await authClient.signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out. Try again.');
      return;
    }
    clearUnlockedWallet();
    setUser(null);
    setWallet(null);
    setUnlockedKey(null);
    setPhase('signed-out');
    setScreen({ id: 'home' });
    onSessionChange?.(null);
    window.dispatchEvent(new Event('devcity-session-changed'));
    onNotify?.('Signed out. This account’s wallet is closed.');
  }

  async function handleRegister() {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      setUsernameStatus('invalid');
      setError('Choose a valid username before creating your passkey.');
      return;
    }

    setError('');
    setAuthAction('register');
    try {
      const availability = await fetch(`/api/usernames/availability?username=${encodeURIComponent(normalized)}`);
      const availabilityData = await availability.json() as { available?: boolean; error?: string };
      if (!availability.ok) throw new Error(availabilityData.error || 'Could not check username availability.');
      if (!availabilityData.available) {
        setUsernameStatus('taken');
        throw new Error('That username is already taken. Choose another one.');
      }

      const result = await authClient.passkey.addPasskey({
        name: `${normalized}.devcity.fun`,
        context: normalized,
        createSession: true,
      });
      if (result.error) throw new Error(result.error.message || 'Could not create account');
      clearUnlockedWallet();
      setWallet(null);
      setUnlockedKey(null);
      await refreshSession();
      window.dispatchEvent(new Event('devcity-session-changed'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setAuthAction(null);
    }
  }

  async function handleCreateWallet() {
    if (!/^\d{6}$/.test(pin)) {
      setError('Choose a 6-digit PIN to encrypt your wallet key.');
      return;
    }
    try {
      const { address, privateKey } = createEOA();
      const encryptedPrivateKey = await encryptWithPassphrase(pin, privateKey);
      const local: LocalWallet = {
        address,
        name: `${handle}.devcity.fun`,
        pinProtected: true,
        encryptedPrivateKey,
        backupConsent: false,
        createdAt: Date.now(),
        userId: user?.id,
      };
      await saveLocalWallet(local);
      setWallet(local);
      // A brand-new wallet is not recoverable until it is backed up.
      setPhase('backup-required');
      setError('');
      setPin('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your wallet');
    }
  }

  async function handleRestoreFromBackup() {
    if (!restoreAddress || !user) return;
    if (!pin) {
      setError('Enter your 6-digit wallet PIN.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Your wallet PIN must be 6 digits.');
      return;
    }
    setBackupSaving(true);
    setError('');
    try {
      const backup = await loadBackupForUser(user.id);
      if (!backup || backup.address.toLowerCase() !== restoreAddress.toLowerCase()) {
        throw new Error('No backup found for this account.');
      }
      const privateKey = (await decryptWithPassphrase(pin, {
        iv: backup.iv,
        data: backup.data,
        salt: backup.salt,
        iterations: backup.iterations,
      })) as Hex;
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(privateKey);
      if (account.address.toLowerCase() !== restoreAddress.toLowerCase()) {
        throw new Error('The restored key does not match the backed-up address.');
      }
      const local: LocalWallet = {
        address: account.address,
        name: wallet?.name ?? `${normalizeUsername(user.name ?? '') ?? 'city-explorer'}.devcity.fun`,
        pinProtected: true,
        encryptedPrivateKey: { iv: backup.iv, data: backup.data, salt: backup.salt, iterations: backup.iterations },
        backupConsent: true,
        backupRef: backup.address,
        createdAt: Date.now(),
        userId: user.id,
      };
      await saveLocalWallet(local);
      setWallet(local);
      setUnlockedKey(privateKey);
      rememberUnlockedWallet(local.address, privateKey);
      setRestoreAddress(null);
      setPhase('ready');
      setPin('');
      onNotify?.('Wallet restored from backup.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore your wallet.');
    } finally {
      setBackupSaving(false);
    }
  }

  async function handleBackup(consent: boolean) {
    if (!wallet || !consent) {
      setWallet(wallet ? { ...wallet, backupConsent: false } : null);
      return;
    }
    setBackupSaving(true);
    setError('');
    try {
      const ref = await uploadEncryptedBackup(wallet.address, wallet.encryptedPrivateKey);
      await saveLocalWallet({ ...wallet, backupConsent: true, backupRef: ref });
      setWallet({ ...wallet, backupConsent: true, backupRef: ref });
      setBackupDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBackupSaving(false);
    }
  }

  if (sessionLoading) {
    return (
      <div className="wallet-auth-frame">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        <p className="you-note">Loading your identity…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="you-connect wallet-auth-gate">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        {showSignup ? (
          <div className="profile-signup-form">
            <p className="you-sheet-lede">Choose your DEVCITY handle. Create a passkey now, then set a PIN for this wallet.</p>
            <label className="profile-username-label" htmlFor="devcity-username">Username</label>
            <div className="profile-username-field">
              <input
                id="devcity-username"
                className="profile-username-input"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={24}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value.toLowerCase());
                  setError('');
                }}
                placeholder="oliseh"
                aria-describedby="devcity-username-status"
              />
              <span>.devcity.fun</span>
            </div>
            <p id="devcity-username-status" className={`profile-username-status is-${usernameStatus}`} aria-live="polite">
              {usernameStatus === 'checking' && 'Checking availability…'}
              {usernameStatus === 'available' && 'This handle is available.'}
              {usernameStatus === 'taken' && 'This handle is already taken.'}
              {usernameStatus === 'invalid' && 'Use 3–24 letters, numbers, or hyphens. No spaces.'}
              {usernameStatus === 'error' && 'Could not check availability. Try again.'}
            </p>
            <Button
              disabled={authAction !== null || usernameStatus !== 'available'}
              onClick={() => void handleRegister()}
            >
              {authAction === 'register' ? 'Waiting for passkey…' : 'Continue with passkey'}
            </Button>
            <Button
              variant="outline"
              disabled={authAction !== null}
              onClick={() => {
                setShowSignup(false);
                setUsername('');
                setUsernameStatus('idle');
                setError('');
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <p className="you-sheet-lede">Sign in to unlock balances, transfers and wallet security.</p>
            <Button
              disabled={authAction !== null}
              onClick={async () => {
                setError('');
                setAuthAction('sign-in');
                try {
                  const result = await authClient.signIn.passkey();
                  if (result.error) throw new Error(result.error.message || 'Passkey sign-in failed');
                  clearUnlockedWallet();
                  setWallet(null);
                  setUnlockedKey(null);
                  await refreshSession();
                  window.dispatchEvent(new Event('devcity-session-changed'));
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Passkey sign-in failed');
                } finally {
                  setAuthAction(null);
                }
              }}
            >
              {authAction === 'sign-in' ? 'Waiting for passkey…' : 'Sign in with passkey'}
            </Button>
            <Button
              variant="outline"
              disabled={authAction !== null}
              onClick={() => {
                setError('');
                setShowSignup(true);
              }}
            >
              Create an account
            </Button>
          </>
        )}
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">Passkey account · local signing wallet created next</p>
        {browserWallet && (
          <section className="external-wallet-section">
            <div>
              <strong>Connected browser wallet</strong>
              <span>{browserWallet.address.slice(0, 8)}…{browserWallet.address.slice(-6)}</span>
            </div>
            <Button type="button" variant="outline" onClick={browserWallet.onDisconnect}>Disconnect</Button>
          </section>
        )}
      </div>
    );
  }

  if (phase === 'registering') {
    return (
      <div className="you-connect wallet-auth-gate">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        <p className="you-sheet-lede">
          Set a 6-digit PIN to encrypt your new wallet on this device.
        </p>
        <PinBoxes id="wallet-register-pin" value={pin} onChange={setPin} />
        <Button disabled={pin.length !== 6} onClick={handleCreateWallet}>
          Create wallet
        </Button>
        <Button type="button" variant="outline" onClick={() => { void leaveAccount(); }}>Sign out</Button>
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">The 6-digit PIN protects this device copy and is weaker if someone obtains its data. There’s no recovery phrase; if forgotten, this wallet can’t be unlocked.</p>
      </div>
    );
  }

  if (phase === 'restore') {
    return (
      <div className="you-connect wallet-auth-gate">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        <p className="you-sheet-lede">
          We found an encrypted backup for <strong>{restoreAddress?.slice(0, 8)}…{restoreAddress?.slice(-6)}</strong> on your account.
        </p>
        <p className="you-note">
          Enter your 6-digit wallet PIN to decrypt the backup and restore this wallet to this device.
        </p>
        <PinBoxes id="wallet-restore-pin" value={pin} onChange={setPin} />
        <Button disabled={pin.length !== 6 || backupSaving} onClick={handleRestoreFromBackup}>
          {backupSaving ? 'Restoring…' : 'Restore wallet'}
        </Button>
        <Button type="button" variant="outline" disabled={backupSaving} onClick={() => { void leaveAccount(); }}>Sign out</Button>
        <Button
          variant="outline"
          disabled={backupSaving}
          onClick={() => { setRestoreAddress(null); setPhase('registering'); setPin(''); setError(''); }}
        >
          Create a new wallet instead
        </Button>
        {error && <p className="you-error">{error}</p>}
      </div>
    );
  }

  if (phase === 'backup-required') {
    return (
      <div className="you-connect wallet-auth-gate">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        <p className="you-sheet-lede">
          Your wallet is ready. Back it up so you can restore it on another device.
        </p>
        <p className="you-note">
          We encrypt your private key with your 6-digit PIN and store only the ciphertext on our server. The server can never read your key.
        </p>
        <label className="you-checkbox">
          <input type="checkbox" checked={wallet?.backupConsent ?? false} disabled={backupSaving} onChange={(e) => void handleBackup(e.target.checked)} />
          <span>Save an encrypted backup</span>
        </label>
        {backupSaving && <p className="you-note">Encrypting and uploading…</p>}
        {backupDone && <p className="you-note">Encrypted backup saved. You can now sign in on any device.</p>}
        <Button
          disabled={backupSaving || !wallet?.backupConsent}
          onClick={() => { setPhase('ready'); }}
        >
          Continue to wallet
        </Button>
        {error && <p className="you-error">{error}</p>}
      </div>
    );
  }

  const celoKnown = celoBalance != null;
  const celoAmount = celoKnown ? Number(celoBalance.value) / 10 ** celoBalance.decimals : null;
  const celoLabel = celoAmount != null ? celoAmount.toFixed(4) : '';
  const pricedHoldings = [
    celoAmount != null && usdPrices.CELO != null ? celoAmount * usdPrices.CELO : null,
    stableBalances.USDT != null && usdPrices.USDT != null ? stableBalances.USDT * usdPrices.USDT : null,
    stableBalances.USDC != null && usdPrices.USDC != null ? stableBalances.USDC * usdPrices.USDC : null,
    stableBalances.USDm != null && (usdPrices.USDm ?? usdPrices.cUSD) != null ? stableBalances.USDm * (usdPrices.USDm ?? usdPrices.cUSD) : null,
  ].filter((value): value is number => value != null);
  const usdBalance = pricedHoldings.length > 0 ? formatUsd(pricedHoldings.reduce((sum, value) => sum + value, 0)) : null;
  const balanceLoading = usdBalance == null && holdingStatus.CELO === 'loading';
  const explorerBase = ACTIVE_CHAIN.blockExplorers?.default.url;
  const availableBySymbol: Record<string, string | null> = {
    CELO: holdingStatus.CELO === 'ready' && celoLabel ? celoLabel : null,
    USDT: stableBalances.USDT != null ? stableBalances.USDT.toFixed(2) : null,
    USDC: stableBalances.USDC != null ? stableBalances.USDC.toFixed(2) : null,
    USDm: stableBalances.USDm != null ? stableBalances.USDm.toFixed(4) : null,
  };
  const accountName = wallet?.name || user?.name || 'Wallet';
  const avatarSrc = avatarMode === 'upload' && avatarImageData
    ? avatarImageData
    : dicebearAvatarUrl(avatarSeed || accountName);
  const accountDetail = wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : '';
  const swapHoldings: SwapHolding[] = [
    { symbol: 'CELO', name: 'CELO', amount: celoAmount, status: holdingStatus.CELO, price: usdPrices.CELO ?? null },
    { symbol: 'USDm', name: 'Mento Dollar', amount: stableBalances.USDm, status: holdingStatus.USDm, price: usdPrices.USDm ?? usdPrices.cUSD ?? null },
    ...(stableBalances.USDT != null && stableBalances.USDT > 0 || holdingStatus.USDT !== 'ready'
      ? [{ symbol: 'USDT', name: 'Tether USD', amount: stableBalances.USDT, status: holdingStatus.USDT, price: usdPrices.USDT ?? null }]
      : []),
    ...(stableBalances.USDC != null && stableBalances.USDC > 0 || holdingStatus.USDC !== 'ready'
      ? [{ symbol: 'USDC', name: 'USD Coin', amount: stableBalances.USDC, status: holdingStatus.USDC, price: usdPrices.USDC ?? null }]
      : []),
  ];
  const flow = screen.id === 'send' || screen.id === 'tip' || screen.id === 'receive' || screen.id === 'token' || screen.id === 'profile';
  const nav: WalletNav = screen.id === 'activity' || screen.id === 'swap' || screen.id === 'settings' || screen.id === 'drops' ? screen.id : 'home';
  const pageTitle = screen.id === 'token' ? screen.token.symbol
    : screen.id === 'send' || screen.id === 'tip' ? 'Send'
    : screen.id === 'receive' ? 'Receive'
    : screen.id === 'swap' ? 'Swap'
    : screen.id === 'profile' ? 'Profile token'
    : screen.id === 'settings' ? 'Settings'
    : screen.id === 'activity' ? 'Activity'
    : screen.id === 'drops' ? 'Badges & drops'
    : 'Wallet';
  async function downloadExport() {
    if (!wallet) return;
    setExporting(true);
    setError('');
    try {
      const response = await fetch(`/api/export?userAddress=${encodeURIComponent(wallet.address)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not export your data.');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `devcity-${wallet.address.slice(0, 8)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      onNotify?.('Export downloaded.');
    } catch (exportError: unknown) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export your data.');
    } finally {
      setExporting(false);
    }
  }

  if (!wallet) {
    return (
      <div className="wallet-auth-frame">
        {onClose && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        <p className="you-note">Preparing your wallet…</p>
      </div>
    );
  }

  const holdings = (presentation: 'summary' | 'table') => (
    <WalletHome
      presentation={presentation}
      celoBalance={celoLabel}
      stableBalances={stableBalances}
      holdingStatus={holdingStatus}
      onRetryHolding={retryHolding}
      usdPrices={usdPrices}
      profileToken={profileToken}
      profileLoading={profileLoading}
      onOpenToken={(token) => setScreen({ id: 'token', token })}
      onOpenProfile={() => setScreen({ id: 'profile' })}
    >
      <WalletTokenTools
        wallet={wallet}
        username={user.name ?? ''}
        assetChainId={chainId}
        assetChainLabel={chainLabel}
        unlockedKey={unlockedKey}
        onUnlockKey={(key) => setUnlockedKey(key)}
        onTokensChange={onImportedTokensChange}
        notify={onNotify}
        focus="assets"
        addExternal
        importSignal={importSignal}
        onSelectImported={(token, balanceLabel) => setScreen({
          id: 'token',
          token: {
            kind: 'imported',
            symbol: token.symbol,
            name: token.name,
            balance: balanceLabel,
            contract: token.address,
            sendToken: `CUSTOM:${token.address}`,
          },
        })}
      />
    </WalletHome>
  );

  return (
    <WalletShell
      nav={nav}
      title={pageTitle}
      subtitle={screen.id === 'home' ? 'Your tokens, your control.' : undefined}
      flow={flow}
      accountName={accountName}
      avatarSrc={avatarSrc}
      accountDetail={accountDetail}
      chainLabel={chainLabel}
      address={wallet.address}
      onNavigate={(next) => { setError(''); setScreen({ id: next }); }}
      onBack={() => { setError(''); setScreen({ id: 'home' }); }}
      onClose={onClose}
      onSignOut={() => { void leaveAccount(); }}
    >
      {screen.id === 'home' && (
        <WalletDashboard
          usdBalance={usdBalance}
          balanceLoading={balanceLoading}
          nativeBalance={celoLabel}
          nativeLoading={holdingStatus.CELO === 'loading'}
          nativeError={holdingStatus.CELO === 'error'}
          onRetryNative={() => retryHolding('CELO')}
          onSend={() => setScreen({ id: 'send' })}
          onReceive={() => setScreen({ id: 'receive' })}
          onSwap={() => setScreen({ id: 'swap' })}
          moreItems={[
            { id: 'activity', label: 'Activity', onClick: () => setScreen({ id: 'activity' }) },
            { id: 'drops', label: 'Badges & drops', onClick: () => setScreen({ id: 'drops' }) },
            ...(onCreateDrop ? [{ id: 'create-drop', label: 'Create a drop', onClick: () => onCreateDrop() }] : []),
            { id: 'settings', label: 'Settings', onClick: () => setScreen({ id: 'settings' }) },
          ]}
          onAddToken={() => setImportSignal((value) => value + 1)}
          onLaunchToken={() => setScreen({ id: 'profile' })}
          launchLabel={profileToken ? 'Profile token' : 'Launch token'}
          summary={holdings('summary')}
          table={holdings('table')}
          activity={(
            <WalletActivity
              address={wallet.address}
              chainLabel={chainLabel}
              explorerBase={explorerBase}
              compact
              limit={4}
              onViewAll={() => setScreen({ id: 'activity' })}
            />
          )}
        />
      )}

      {(screen.id === 'send' || screen.id === 'tip') && (
        <>
          <div className="wallet-segment" role="tablist" aria-label="Send or tip">
            <button type="button" role="tab" aria-selected={screen.id === 'send'} className={screen.id === 'send' ? 'is-active' : ''} onClick={() => setScreen({ id: 'send', token: screen.id === 'send' ? screen.token : undefined })}>Send</button>
            <button type="button" role="tab" aria-selected={screen.id === 'tip'} className={screen.id === 'tip' ? 'is-active' : ''} onClick={() => setScreen({ id: 'tip' })}>Tip</button>
          </div>
          {screen.id === 'send' ? (
            <WalletSendTab
              address={wallet.address}
              pinProtected={wallet.pinProtected}
              unlockedKey={unlockedKey}
              fees={fees}
              importedTokens={importedTokens}
              feeSymbol={feeSymbol}
              setFeeSymbol={setFeeSymbol}
              initialToken={screen.token}
              chainLabel={chainLabel}
              availableBySymbol={availableBySymbol}
              notify={onNotify}
            />
          ) : (
            <WalletTipTab
              address={wallet.address}
              pinProtected={wallet.pinProtected}
              unlockedKey={unlockedKey}
              fees={fees}
              importedTokens={importedTokens}
              feeSymbol={feeSymbol}
              notify={onNotify}
            />
          )}
        </>
      )}

      {screen.id === 'receive' && (
        <WalletReceive address={wallet.address} chainLabel={chainLabel} symbol={screen.symbol} notify={onNotify} />
      )}

      {screen.id === 'swap' && (
        <WalletSwap tokens={swapHoldings} chainLabel={chainLabel} />
      )}

      {screen.id === 'profile' && (
        <>
          <WalletTokenTools
            wallet={wallet}
            username={user.name ?? ''}
            assetChainId={chainId}
            assetChainLabel={chainLabel}
            unlockedKey={unlockedKey}
            onUnlockKey={(key) => setUnlockedKey(key)}
            onTokensChange={onImportedTokensChange}
            notify={onNotify}
            focus="profile"
          />
        </>
      )}

      {screen.id === 'token' && (
        <>
          <WalletTokenDetail
            token={screen.token}
            chainLabel={chainLabel}
            explorerBase={explorerBase}
            balanceLoading={
              (screen.token.symbol === 'CELO' && holdingStatus.CELO === 'loading')
              || (screen.token.symbol === 'USDT' && holdingStatus.USDT === 'loading')
              || (screen.token.symbol === 'USDC' && holdingStatus.USDC === 'loading')
              || (screen.token.symbol === 'USDm' && holdingStatus.USDm === 'loading')
            }
            usdLabel={(() => {
              const quantity = Number(screen.token.balance);
              const price = usdPrices[screen.token.symbol] ?? (screen.token.symbol === 'USDm' ? usdPrices.cUSD : undefined);
              if (!Number.isFinite(quantity) || price == null) return null;
              return formatUsd(quantity * price);
            })()}
            onSend={() => setScreen({ id: 'send', token: screen.token.sendToken })}
            onReceive={() => setScreen({ id: 'receive', symbol: screen.token.symbol })}
            onRemove={screen.token.kind === 'imported' && screen.token.contract ? () => {
              removeImportedWalletToken(wallet.address, chainId, screen.token.contract as Address);
              onImportedTokensChange(importedTokens.filter((item) => item.address !== screen.token.contract));
              setScreen({ id: 'home' });
              onNotify?.(`${screen.token.symbol} removed from this list.`);
            } : undefined}
            activity={(
              <WalletActivity
                address={wallet.address}
                chainLabel={chainLabel}
                explorerBase={explorerBase}
                symbol={screen.token.symbol}
              />
            )}
          />
        </>
      )}

      {screen.id === 'activity' && (
        <WalletActivity address={wallet.address} chainLabel={chainLabel} explorerBase={explorerBase} />
      )}

      {screen.id === 'drops' && (
        <WalletCityTab address={wallet.address} explorerBase={explorerBase} onCreateDrop={onCreateDrop} />
      )}

      {screen.id === 'settings' && (
        <WalletSettings
          accountName={accountName}
          chainLabel={chainLabel}
          address={wallet.address}
          fees={fees}
          feeSymbol={feeSymbol}
          onFeeSymbol={setFeeSymbol}
          wallet={wallet}
          unlockedKey={unlockedKey}
          onWalletChange={(next) => setWallet(next)}
          onUnlockKey={(key) => setUnlockedKey(key)}
          notify={onNotify}
          onSignOut={() => { void leaveAccount(); }}
          exporting={exporting}
          onExport={() => { void downloadExport(); }}
          browserWallet={browserWallet}
        />
      )}

      {error && <p className="you-error" role="alert">{error}</p>}
    </WalletShell>
  );
}
