'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  listLocalWallets,
  uploadEncryptedBackup,
  decryptWithPassphrase,
  loadBackupForUser,
  type LocalWallet,
} from '@/lib/keystore';
import { ACTIVE_CHAIN, CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, feeCurrenciesFor } from '@/lib/celo';
import { ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';
import { removeImportedWalletToken, type ImportedWalletToken } from '@/lib/wallet-assets';
import { WalletTradeTab } from './wallet/WalletTradeTab';
import { WalletOverview } from './wallet/WalletOverview';
import { WalletHome } from './wallet/WalletHome';
import { WalletSendTab } from './wallet/WalletSendTab';
import { WalletTipTab } from './wallet/WalletTipTab';
import { WalletSecurityTab } from './wallet/WalletSecurityTab';
import { WalletReceive } from './wallet/WalletReceive';
import { WalletActivity } from './wallet/WalletActivity';
import { WalletTokenDetail } from './wallet/WalletTokenDetail';
import { WalletTokenTools } from './WalletTokenTools';
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
  | { id: 'activity' };

interface PasskeyWalletProps {
  onSessionChange?: (user: SessionUser | null) => void;
  onSessionReady?: () => void;
  onNotify?: (message: string) => void;
  onCreateDrop?: () => void;
  browserWallet?: { address: string; onDisconnect: () => void } | null;
}

export function PasskeyWallet({ onSessionChange, onSessionReady, onNotify, onCreateDrop, browserWallet }: PasskeyWalletProps) {
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
  const [exporting, setExporting] = useState(false);
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

  const { token: profileToken, loading: profileLoading } = useProfileToken(wallet?.address);
  const usdPrices = useUsdPrices();
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

  // Reuse the already-unlocked key from this session so reopening the wallet
  // (or remounting) never re-prompts for the PIN just to view balances/tokens.
  // The PIN itself is never persisted — only the decrypted key in memory.
  useEffect(() => {
    if (!wallet?.address) return;
    const existing = getUnlockedPrivateKey(wallet.address);
    if (existing) setUnlockedKey(existing);
  }, [wallet?.address]);

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
        {browserWallet && (
          <section className="external-wallet-section">
            <div>
              <strong>Connected browser wallet</strong>
              <span>{browserWallet.address.slice(0, 8)}…{browserWallet.address.slice(-6)}</span>
            </div>
            <button type="button" onClick={browserWallet.onDisconnect}>Disconnect</button>
          </section>
        )}
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

  const celoAmount = Number(celoBalance?.value ?? BigInt(0)) / 10 ** (celoBalance?.decimals ?? 18);
  const celoLabel = celoAmount.toFixed(4);
  const pricedHoldings = [
    usdPrices.CELO != null ? celoAmount * usdPrices.CELO : null,
    usdPrices.USDT != null ? (stableBalances.USDT ?? 0) * usdPrices.USDT : null,
    usdPrices.USDC != null ? (stableBalances.USDC ?? 0) * usdPrices.USDC : null,
    usdPrices.cUSD != null ? (stableBalances.cUSD ?? 0) * usdPrices.cUSD : null,
  ].filter((value): value is number => value != null && value > 0);
  const usdBalance = pricedHoldings.length > 0 ? formatUsd(pricedHoldings.reduce((sum, value) => sum + value, 0)) : null;
  const explorerBase = ACTIVE_CHAIN.blockExplorers?.default.url;
  const backBar = (title: string) => (
    <div className="wallet-backbar">
      <button type="button" onClick={() => { setScreen({ id: 'home' }); setError(''); }}>Back</button>
      <h2>{title}</h2>
    </div>
  );

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

  return (
    <div className="wallet-screen">
      {screen.id === 'home' && wallet && (
        <>
          <WalletOverview
            chainLabel={chainLabel}
            name={wallet.name}
            address={wallet.address}
            celoBalance={celoLabel}
            usdBalance={usdBalance}
            onSend={() => setScreen({ id: 'send' })}
            onReceive={() => setScreen({ id: 'receive' })}
            onSwap={() => setScreen({ id: 'swap' })}
            onDrop={() => onCreateDrop?.()}
            onActivity={() => setScreen({ id: 'activity' })}
            onSettings={() => setScreen({ id: 'settings' })}
          />
          <WalletHome
            celoBalance={celoLabel}
            stableBalances={stableBalances}
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
              onSelectImported={(token, balanceLabel, valueLabel) => setScreen({
                id: 'token',
                token: {
                  kind: 'imported',
                  symbol: token.symbol,
                  name: token.name,
                  balance: `${balanceLabel} · ${valueLabel}`,
                  contract: token.address,
                  sendToken: `CUSTOM:${token.address}`,
                },
              })}
            />
          </WalletHome>
        </>
      )}

      {(screen.id === 'send' || screen.id === 'tip') && wallet && (
        <>
          {backBar(screen.id === 'tip' ? 'Tip' : 'Send')}
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
              notify={onNotify}
            />
          ) : (
            <WalletTipTab
              address={wallet.address}
              pinProtected={wallet.pinProtected}
              unlockedKey={unlockedKey}
              fees={fees}
              importedTokens={importedTokens}
              notify={onNotify}
            />
          )}
        </>
      )}

      {screen.id === 'receive' && wallet && (
        <>
          {backBar('Receive')}
          <WalletReceive address={wallet.address} chainLabel={chainLabel} symbol={screen.symbol} notify={onNotify} />
        </>
      )}

      {screen.id === 'swap' && wallet && (
        <>
          {backBar('Swap')}
          <section className="wallet-swap-block">
            <h3>Profile token</h3>
            <p className="you-note">Signs with this passkey wallet.</p>
            <WalletTokenTools
              wallet={wallet}
              username={user.name ?? ''}
              assetChainId={chainId}
              assetChainLabel={chainLabel}
              unlockedKey={unlockedKey}
              onUnlockKey={(key) => setUnlockedKey(key)}
              onTokensChange={onImportedTokensChange}
              notify={onNotify}
              focus="trade"
            />
          </section>
          <section className="wallet-swap-block">
            <h3>DEV26</h3>
            <p className="you-note">Signs with a connected browser wallet. That account is separate from this passkey vault.</p>
            <WalletTradeTab />
          </section>
        </>
      )}

      {screen.id === 'profile' && wallet && (
        <>
          {backBar('Profile token')}
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

      {screen.id === 'token' && wallet && (
        <>
          {backBar(screen.token.symbol)}
          <WalletTokenDetail
            token={screen.token}
            explorerBase={explorerBase}
            onSend={() => setScreen({ id: 'send', token: screen.token.sendToken })}
            onReceive={() => setScreen({ id: 'receive', symbol: screen.token.symbol })}
            onRemove={screen.token.kind === 'imported' && screen.token.contract ? () => {
              removeImportedWalletToken(wallet.address, chainId, screen.token.contract as Address);
              onImportedTokensChange(importedTokens.filter((item) => item.address !== screen.token.contract));
              setScreen({ id: 'home' });
              onNotify?.(`${screen.token.symbol} removed from this list.`);
            } : undefined}
          />
        </>
      )}

      {screen.id === 'activity' && wallet && (
        <>
          {backBar('Activity')}
          <WalletActivity address={wallet.address} />
        </>
      )}

      {screen.id === 'settings' && wallet && (
        <>
          {backBar('Settings')}
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
              setScreen({ id: 'home' });
              onSessionChange?.(null);
              onNotify?.('Signed out of DEVCITY.');
            }}
            notify={onNotify}
          />
          <section className="wallet-settings-block">
            <h3>Your data</h3>
            <p className="you-note">Download the profile, posts, tips, and claims stored for this wallet.</p>
            <button type="button" className="you-connect-secondary" disabled={exporting} onClick={() => void downloadExport()}>
              {exporting ? 'Preparing…' : 'Download my data'}
            </button>
          </section>
          {browserWallet && (
            <section className="external-wallet-section">
              <div>
                <strong>Connected browser wallet</strong>
                <span>{browserWallet.address.slice(0, 8)}…{browserWallet.address.slice(-6)}</span>
              </div>
              <button type="button" onClick={browserWallet.onDisconnect}>Disconnect</button>
            </section>
          )}
        </>
      )}

      {error && <p className="you-error" role="alert">{error}</p>}
    </div>
  );
}
