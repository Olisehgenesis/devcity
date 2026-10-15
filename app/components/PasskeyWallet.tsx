'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { privateKeyToAccount } from 'viem/accounts';
import { authClient } from '@/lib/auth-client';
import { normalizeUsername } from '@/lib/usernames';
import { clearUnlockedWallet, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import {
  createEOA,
  encryptWithPassphrase,
  saveLocalWallet,
  loadLocalWallet,
  listLocalWallets,
  uploadEncryptedBackup,
  decryptWithPassphrase,
  loadBackupForUser,
  type LocalWallet,
} from '@/lib/keystore';
import { CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, feeCurrenciesFor } from '@/lib/celo';
import { ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';
import { WalletTradeTab } from './wallet/WalletTradeTab';
import { WalletOverview, type WalletTabId } from './wallet/WalletOverview';
import { WalletAssetsTab } from './wallet/WalletAssetsTab';
import { WalletSendTab } from './wallet/WalletSendTab';
import { WalletTipTab } from './wallet/WalletTipTab';
import { WalletDropTab } from './wallet/WalletDropTab';
import { WalletTokenTab } from './wallet/WalletTokenTab';
import { WalletSecurityTab } from './wallet/WalletSecurityTab';
import type { ImportedWalletToken } from '@/lib/wallet-assets';
import { useProfileToken } from '../hooks/useProfileToken';

type Phase = 'signed-out' | 'registering' | 'ready' | 'restore' | 'backup-required';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface PasskeyWalletProps {
  onSessionChange?: (user: SessionUser | null) => void;
  onSessionReady?: () => void;
  onNotify?: (message: string) => void;
}

export function PasskeyWallet({ onSessionChange, onSessionReady, onNotify }: PasskeyWalletProps) {
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
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<WalletTabId>('assets');
  const [restoreAddress, setRestoreAddress] = useState<string | null>(null);

  // Fee currency selection (default USDT, then USDC, cUSD, ...)
  const [feeSymbol, setFeeSymbol] = useState('USDT');
  const [importedTokens, setImportedTokens] = useState<ImportedWalletToken[]>([]);
  const onImportedTokensChange = useCallback((tokens: ImportedWalletToken[]) => setImportedTokens(tokens), []);

  const chainId = IS_MAINNET ? CELO_MAINNET_ID : CELO_SEPOLIA_ID;
  const chainLabel = IS_MAINNET ? 'Celo' : 'Celo Sepolia';
  const addr = wallet?.address;
  const fees = feeCurrenciesFor(chainId);
  const handle = normalizeUsername(username) ?? normalizeUsername(user?.name ?? '') ?? 'city-explorer';
  const handleTicker = handle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'CITY';

  async function copyWalletAddress() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      onNotify?.('Wallet address copied.');
    } catch (copyError: unknown) {
      setError(copyError instanceof Error ? `Could not copy address: ${copyError.message}` : 'Could not copy wallet address.');
    }
  }

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
  const { data: celoBalance } = useBalance({ address: addr as Address, query: { enabled: !!addr } });
  const usdtBal = useReadContract({
    address: fees.find((f) => f.symbol === 'USDT')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr },
  });
  const usdcBal = useReadContract({
    address: fees.find((f) => f.symbol === 'USDC')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr },
  });
  const cusdBal = useReadContract({
    address: fees.find((f) => f.symbol === 'cUSD')?.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: addr ? [addr as Address] : undefined,
    query: { enabled: !!addr },
  });

  const stableBalances: Record<string, number> = useMemo(() => {
    const fmt = (raw: unknown, decimals: number) => {
      if (raw == null) return 0;
      return Number(raw) / 10 ** decimals;
    };
    return {
      USDT: fmt(usdtBal.data, 6),
      USDC: fmt(usdcBal.data, 6),
      cUSD: fmt(cusdBal.data, 18),
    };
  }, [usdtBal.data, usdcBal.data, cusdBal.data]);

  const { token: profileToken, reload: reloadProfileToken } = useProfileToken(wallet?.address);
  async function refreshSession() {
    try {
      const res = await authClient.getSession();
      const next = (res?.data as { user?: SessionUser } | null)?.user ?? null;
      setUser(next);
      onSessionChange?.(next);
      if (next) {
        await resolveWalletForUser(next.id);
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
  }, []);

  async function resolveWalletForUser(uid: string) {
    const local = await listLocalWallets();
    if (local.length > 0) {
      setWallet(local[0]);
      setPhase('ready');
      return;
    }

    // No wallet on this device — check for a server backup tied to this account.
    try {
      const backup = await loadBackupForUser(uid);
      if (backup) {
        setRestoreAddress(backup.address);
        setPhase('restore');
        return;
      }
    } catch (restoreError) {
      // Non-fatal: fall through to wallet creation if the lookup itself fails.
      setError(restoreError instanceof Error ? restoreError.message : 'Could not check for a wallet backup.');
    }

    setPhase('registering');
    setError('');
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
      await refreshSession();
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
    return <p className="you-note">Loading your identity…</p>;
  }

  if (!user) {
    return (
      <div className="you-connect wallet-auth-gate">
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
            <button
              className="you-connect-primary"
              disabled={authAction !== null || usernameStatus !== 'available'}
              onClick={() => void handleRegister()}
            >
              {authAction === 'register' ? 'Waiting for passkey…' : 'Continue with passkey'}
            </button>
            <button
              className="you-connect-secondary"
              disabled={authAction !== null}
              onClick={() => {
                setShowSignup(false);
                setUsername('');
                setUsernameStatus('idle');
                setError('');
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <p className="you-sheet-lede">Sign in to unlock balances, transfers and wallet security.</p>
            <button
              className="you-connect-primary"
              disabled={authAction !== null}
              onClick={async () => {
                setError('');
                setAuthAction('sign-in');
                try {
                  const result = await authClient.signIn.passkey();
                  if (result.error) throw new Error(result.error.message || 'Passkey sign-in failed');
                  await refreshSession();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Passkey sign-in failed');
                } finally {
                  setAuthAction(null);
                }
              }}
            >
              {authAction === 'sign-in' ? 'Waiting for passkey…' : 'Sign in with passkey'}
            </button>
            <button
              className="you-connect-secondary"
              disabled={authAction !== null}
              onClick={() => {
                setError('');
                setShowSignup(true);
              }}
            >
              Create an account
            </button>
          </>
        )}
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">Passkey account · local signing wallet created next</p>
      </div>
    );
  }

  if (phase === 'registering') {
    return (
      <div className="you-connect wallet-auth-gate">
        <p className="you-sheet-lede">
          Set a 6-digit PIN to encrypt your new wallet on this device.
        </p>
        <input
          type="password"
          className="you-passphrase"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit wallet PIN"
          aria-label="6-digit wallet PIN"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
        />
        <button className="you-connect-primary" disabled={pin.length !== 6} onClick={handleCreateWallet}>
          Create wallet
        </button>
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">The 6-digit PIN protects this device copy and is weaker if someone obtains its data. There’s no recovery phrase; if forgotten, this wallet can’t be unlocked.</p>
      </div>
    );
  }

  if (phase === 'restore') {
    return (
      <div className="you-connect wallet-auth-gate">
        <p className="you-sheet-lede">
          We found an encrypted backup for <strong>{restoreAddress?.slice(0, 8)}…{restoreAddress?.slice(-6)}</strong> on your account.
        </p>
        <p className="you-note">
          Enter your 6-digit wallet PIN to decrypt the backup and restore this wallet to this device.
        </p>
        <input
          type="password"
          className="you-passphrase"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit wallet PIN"
          aria-label="6-digit wallet PIN"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
        />
        <button className="you-connect-primary" disabled={pin.length !== 6 || backupSaving} onClick={handleRestoreFromBackup}>
          {backupSaving ? 'Restoring…' : 'Restore wallet'}
        </button>
        <button
          className="you-connect-secondary"
          disabled={backupSaving}
          onClick={() => { setRestoreAddress(null); setPhase('registering'); setPin(''); setError(''); }}
        >
          Create a new wallet instead
        </button>
        {error && <p className="you-error">{error}</p>}
      </div>
    );
  }

  if (phase === 'backup-required') {
    return (
      <div className="you-connect wallet-auth-gate">
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
        <button
          className="you-connect-primary"
          disabled={backupSaving || !wallet?.backupConsent}
          onClick={() => { setPhase('ready'); }}
        >
          Continue to wallet
        </button>
        {error && <p className="you-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="wallet-screen">
      <WalletOverview
        chainLabel={chainLabel}
        chainId={chainId}
        name={wallet?.name}
        address={wallet?.address}
        pinProtected={wallet?.pinProtected}
        celoBalance={(Number(celoBalance?.value ?? BigInt(0)) / 10 ** (celoBalance?.decimals ?? 18)).toFixed(4)}
        profileToken={profileToken}
        copied={copied}
        onCopy={() => void copyWalletAddress()}
        tab={tab}
        onTab={(t) => { setTab(t); setError(''); }}
      />

      {tab === 'assets' && wallet && (
        <WalletAssetsTab
          wallet={wallet}
          username={user.name ?? ''}
          chainId={chainId}
          chainLabel={chainLabel}
          stableBalances={stableBalances}
          profileToken={profileToken}
          unlockedKey={unlockedKey}
          onUnlockKey={(key) => setUnlockedKey(key)}
          onTokensChange={onImportedTokensChange}
          notify={onNotify}
        />
      )}

      {tab === 'send' && wallet && (
        <WalletSendTab
          address={wallet.address}
          pinProtected={wallet.pinProtected}
          unlockedKey={unlockedKey}
          fees={fees}
          importedTokens={importedTokens}
          feeSymbol={feeSymbol}
          setFeeSymbol={setFeeSymbol}
          notify={onNotify}
        />
      )}

      {tab === 'tip' && wallet && (
        <WalletTipTab
          address={wallet.address}
          pinProtected={wallet.pinProtected}
          unlockedKey={unlockedKey}
          fees={fees}
          importedTokens={importedTokens}
          notify={onNotify}
        />
      )}

      {tab === 'drop' && wallet && (
        <WalletDropTab
          address={wallet.address}
          pinProtected={wallet.pinProtected}
          unlockedKey={unlockedKey}
          fees={fees}
          importedTokens={importedTokens}
          notify={onNotify}
        />
      )}

      {tab === 'token' && wallet && (
        <WalletTokenTab
          address={wallet.address}
          pinProtected={wallet.pinProtected}
          unlockedKey={unlockedKey}
          handle={handle}
          handleTicker={handleTicker}
          notify={onNotify}
        />
      )}

      {tab === 'trade' && wallet && (
        <WalletTradeTab />
      )}

      {tab === 'security' && wallet && (
        <WalletSecurityTab
          wallet={wallet}
          unlockedKey={unlockedKey}
          fees={fees}
          feeSymbol={feeSymbol}
          setFeeSymbol={setFeeSymbol}
          onWalletChange={(next) => setWallet(next)}
          onUnlockKey={(key) => setUnlockedKey(key)}
          onSignOut={() => {
            setUser(null);
            setWallet(null);
            setUnlockedKey(null);
            setPhase('signed-out');
            onSessionChange?.(null);
            onNotify?.('Signed out of DEVCITY.');
          }}
          notify={onNotify}
        />
      )}

      {error && <p className="you-error" role="alert">{error}</p>}
    </div>
  );
}
