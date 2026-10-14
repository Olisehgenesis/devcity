'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { useBalance, useReadContract } from 'wagmi';
import { createWalletClient, getAddress, http, isAddress, parseUnits } from 'viem';
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
  type LocalWallet,
} from '@/lib/keystore';
import { CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, ACTIVE_CHAIN, feeCurrenciesFor, toGasCurrency } from '@/lib/celo';
import { ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';
import { WalletTokenTools } from './WalletTokenTools';
import type { ImportedWalletToken } from '@/lib/wallet-assets';

type Phase = 'signed-out' | 'registering' | 'ready';

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
  const [walletAction, setWalletAction] = useState<'receive' | 'send' | null>(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [transactionExplorer, setTransactionExplorer] = useState('');

  // Fee currency selection (default USDT, then USDC, cUSD, ...)
  const [feeSymbol, setFeeSymbol] = useState('USDT');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState('USDT');
  const [sending, setSending] = useState(false);
  const [importedTokens, setImportedTokens] = useState<ImportedWalletToken[]>([]);
  const onImportedTokensChange = useCallback((tokens: ImportedWalletToken[]) => setImportedTokens(tokens), []);

  const chainId = IS_MAINNET ? CELO_MAINNET_ID : CELO_SEPOLIA_ID;
  const chainLabel = IS_MAINNET ? 'Celo' : 'Celo Sepolia';
  const addr = wallet?.address;
  const fees = feeCurrenciesFor(chainId);

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
  const customSendToken = importedTokens.find((item) => sendToken === `CUSTOM:${item.address}`);
  const sendTokenLabel = customSendToken?.symbol ?? sendToken;

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
      const handle = normalizeUsername(username) ?? normalizeUsername(user?.name ?? '') ?? 'city-explorer';
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
      setPhase('ready');
      setError('');
      setPin('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your wallet');
    }
  }

  async function handleUnlock() {
    if (!wallet) return;
    if (!pin) {
      setError(wallet.pinProtected ? 'Enter your 6-digit wallet PIN.' : 'Enter your wallet passphrase.');
      return;
    }
    if (wallet.pinProtected && !/^\d{6}$/.test(pin)) {
      setError('Your wallet PIN must be 6 digits.');
      return;
    }
    try {
      const local = await loadLocalWallet(wallet.address);
      if (!local) throw new Error('Wallet not found on this device');
      const privateKey = (await decryptWithPassphrase(pin, local.encryptedPrivateKey)) as Hex;
      setUnlockedKey(privateKey);
      rememberUnlockedWallet(local.address, privateKey);
      setError('');
      setPin('');
    } catch (e) {
      setError(e instanceof Error ? e.message : wallet.pinProtected ? 'Incorrect wallet PIN.' : 'Wrong wallet passphrase.');
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

  async function handleSend() {
    if (!wallet || !unlockedKey) {
      setError('Unlock your wallet first.');
      return;
    }
    const feeCurrency = toGasCurrency(chainId, feeSymbol);
    if (!isAddress(sendTo)) {
      setError('Enter a valid recipient address.');
      return;
    }
    const token = sendToken === 'CELO'
      ? null
      : fees.find((f) => f.symbol === sendToken)
        ?? customSendToken;
    if (sendToken.startsWith('CUSTOM:') && !customSendToken) {
      setError('That imported token is no longer in your wallet list. Choose another token.');
      return;
    }
    if (sendToken !== 'CELO' && !token) {
      setError('Select a token supported on this network.');
      return;
    }
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) {
      setError('Enter a recipient and amount.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const account = privateKeyToAccount(unlockedKey);
      const client = createWalletClient({
        account,
        chain: ACTIVE_CHAIN,
        transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
      });
      let hash: Hex;
      if (token) {
        const amount = parseUnits(sendAmount, token.decimals);
        hash = await client.writeContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(sendTo), amount],
          ...(feeCurrency ? { gasCurrency: feeCurrency as Address } : {}),
        } as any);
      } else {
        const amount = parseUnits(sendAmount, 18);
        hash = await client.sendTransaction({
          to: getAddress(sendTo),
          value: amount,
          ...(feeCurrency ? { gasCurrency: feeCurrency as Address } : {}),
        } as any);
      }
      setError('');
      setTransactionHash(hash);
      setTransactionExplorer(ACTIVE_CHAIN.blockExplorers?.default.url ?? '');
      setSendAmount('');
      setSendTo('');
      onNotify?.('Transaction submitted.');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Send failed');
    } finally {
      setSending(false);
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

  return (
    <div className="wallet-screen">
      <section className="wallet-overview">
        <div className="wallet-overview-topline">
          <span className="wallet-network"><i /> {chainLabel}</span>
          <span className="wallet-security-status"><ShieldCheck size={13} /> {wallet?.pinProtected ? 'PIN protected' : 'Passphrase protected'}</span>
        </div>
        <div className="wallet-owner">{wallet?.name || user.name || 'My wallet'}</div>
        <button className="wallet-address-copy" onClick={() => void copyWalletAddress()} aria-label={copied ? 'Wallet address copied' : 'Copy this wallet address'}>
          <span>{wallet?.address.slice(0, 10)}…{wallet?.address.slice(-8)}</span>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <small>{copied ? 'Copied' : 'Copy address'}</small>
        </button>
        <div className="wallet-main-balance">
          <span>CELO balance</span>
          <strong>{(Number(celoBalance?.value ?? BigInt(0)) / 10 ** (celoBalance?.decimals ?? 18)).toFixed(4)} <small>CELO</small></strong>
        </div>
        <div className="wallet-primary-actions">
          <button onClick={() => { setError(''); setWalletAction(walletAction === 'receive' ? null : 'receive'); setTransactionHash(''); }}>
            <ArrowDownToLine size={17} /> Receive
          </button>
          <button onClick={() => { setError(''); setWalletAction(walletAction === 'send' ? null : 'send'); setTransactionHash(''); }}>
            <ArrowUpRight size={17} /> Send
          </button>
        </div>
      </section>

      <section className="wallet-token-section" aria-labelledby="wallet-assets-title">
        <div className="wallet-section-heading"><h3 id="wallet-assets-title">Your assets</h3><span>On {chainLabel}</span></div>
        <div className="wallet-token-list">
          {(['USDT', 'USDC', 'cUSD'] as const).map((sym) => (
            <div className="wallet-token-row" key={sym}>
              <span className={`wallet-token-mark wallet-token-${sym.toLowerCase()}`}>{sym.slice(0, 1)}</span>
              <span className="wallet-token-name"><strong>{sym}</strong><small>{sym === 'cUSD' ? 'Celo Dollar' : sym === 'USDT' ? 'Tether USD' : 'USD Coin'}</small></span>
              <strong className="wallet-token-balance">{stableBalances[sym].toFixed(sym === 'cUSD' ? 4 : 2)}</strong>
            </div>
          ))}
        </div>
      </section>

      {wallet && (
        <WalletTokenTools
          wallet={wallet}
          username={user.name ?? ''}
          assetChainId={chainId}
          assetChainLabel={chainLabel}
          unlockedKey={unlockedKey}
          onUnlockKey={(privateKey) => setUnlockedKey(privateKey)}
          onTokensChange={onImportedTokensChange}
          notify={onNotify}
        />
      )}

      {walletAction === 'receive' && (
        <section className="wallet-action-panel" aria-labelledby="wallet-receive-title">
          <div className="wallet-section-heading">
            <h3 id="wallet-receive-title">Receive to this wallet</h3>
            <button onClick={() => setWalletAction(null)} aria-label="Close receive details">Close</button>
          </div>
          <p className="wallet-receive-network">Copy this wallet address to receive funds. Only send assets on <strong>{chainLabel}</strong>.</p>
          <button className="wallet-address-copy wallet-address-copy-full" onClick={() => void copyWalletAddress()}>
            <span>{wallet?.address}</span>{copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </section>
      )}

      {walletAction === 'send' && (
        <section className="wallet-action-panel" aria-labelledby="wallet-send-title">
          <div className="wallet-section-heading">
            <h3 id="wallet-send-title">Send from this wallet</h3>
            <button onClick={() => setWalletAction(null)} aria-label="Close send form">Close</button>
          </div>
          {!unlockedKey ? (
            <div className="wallet-unlock">
              <p>Unlock to review and send a transaction.</p>
              <input
                type="password"
                className="you-passphrase"
                value={pin}
                onChange={(e) => setPin(wallet?.pinProtected ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
                placeholder={wallet?.pinProtected ? '6-digit wallet PIN' : 'Wallet passphrase'}
                aria-label={wallet?.pinProtected ? '6-digit wallet PIN' : 'Wallet passphrase'}
                inputMode={wallet?.pinProtected ? 'numeric' : undefined}
                maxLength={wallet?.pinProtected ? 6 : undefined}
                autoComplete="current-password"
              />
              <button className="you-connect-primary" disabled={!pin || Boolean(wallet?.pinProtected && pin.length !== 6)} onClick={() => void handleUnlock()}>
                <KeyRound size={16} /> Unlock wallet
              </button>
            </div>
          ) : (
            <>
              <label className="wallet-field-label" htmlFor="wallet-send-recipient">Recipient address</label>
              <input
                id="wallet-send-recipient"
                className="you-passphrase"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
              />
              <label className="wallet-field-label" htmlFor="wallet-send-amount">Amount</label>
              <div className="wallet-send-amount-row">
                <input
                  id="wallet-send-amount"
                  className="you-passphrase"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <select
                  className="send-token-select"
                  value={sendToken}
                  onChange={(e) => setSendToken(e.target.value)}
                  aria-label="Token to send"
                >
                  <option value="CELO">CELO</option>
                  {fees.map((fee) => <option key={fee.symbol} value={fee.symbol}>{fee.symbol}</option>)}
                  {importedTokens.map((customToken) => (
                    <option key={customToken.address} value={`CUSTOM:${customToken.address}`}>
                      {customToken.symbol} · {customToken.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="wallet-send-caution">Check the recipient and network carefully. Transactions can’t be reversed.</p>
              <button className="you-connect-primary" disabled={sending || !sendTo || !sendAmount} onClick={() => void handleSend()}>
                {sending ? 'Sending…' : `Send ${sendTokenLabel} · gas in ${customSendToken ? 'CELO on Sepolia' : feeSymbol}`}
              </button>
            </>
          )}
          {transactionHash && <p className="wallet-transaction-status" role="status">Transaction submitted: <a href={`${transactionExplorer}/tx/${transactionHash}`} target="_blank" rel="noreferrer">{transactionHash.slice(0, 10)}…</a></p>}
        </section>
      )}

      <details className="wallet-security-details">
        <summary><ShieldCheck size={17} /> Security, fees & backup <span>Manage</span></summary>
        <div className="wallet-security-content">
          <p className="profile-control-hint">
            Your signing key stays encrypted on this device with {wallet?.pinProtected ? 'your 6-digit PIN' : 'your wallet passphrase'}. {wallet?.pinProtected ? 'There is no recovery phrase; if you forget your PIN, this wallet cannot be unlocked.' : 'Keep your passphrase private.'}
          </p>
          <h3 className="you-section-title">Pay network fees with</h3>
          <div className="fee-currency-row">
            {fees.map((f) => (
              <button key={f.symbol} className={`fee-currency-chip${feeSymbol === f.symbol ? ' is-selected' : ''}`} onClick={() => setFeeSymbol(f.symbol)}>
                {f.symbol}
              </button>
            ))}
          </div>
          <h3 className="you-section-title wallet-backup-title">Encrypted backup</h3>
          <label className="you-checkbox">
            <input type="checkbox" checked={wallet?.backupConsent ?? false} disabled={backupSaving} onChange={(e) => void handleBackup(e.target.checked)} />
            <span>Save an encrypted backup</span>
          </label>
          {backupSaving && <p className="you-note">Encrypting and uploading…</p>}
          {backupDone && <p className="you-note">Encrypted backup saved.</p>}
          <button
            className="you-disconnect wallet-signout"
            onClick={() => {
              void authClient.signOut();
              clearUnlockedWallet();
              setUser(null);
              onSessionChange?.(null);
              setWallet(null);
              setUnlockedKey(null);
              setPhase('signed-out');
              onNotify?.('Signed out of DEVCITY.');
            }}
          >
            Sign out
          </button>
        </div>
      </details>

      {error && <p className="you-error" role="alert">{error}</p>}
    </div>
  );
}
