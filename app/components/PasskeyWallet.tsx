'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { authClient } from '@/lib/auth-client';
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
import { getInitials } from '@/lib/utils';
import { CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, ACTIVE_CHAIN, feeCurrenciesFor, toGasCurrency } from '@/lib/celo';
import { ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';

type Phase = 'signed-out' | 'registering' | 'ready';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface PasskeyWalletProps {
  onSessionChange?: (user: SessionUser | null) => void;
  onSessionReady?: () => void;
}

export function PasskeyWallet({ onSessionChange, onSessionReady }: PasskeyWalletProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('signed-out');
  const [wallet, setWallet] = useState<LocalWallet | null>(null);
  const [unlockedKey, setUnlockedKey] = useState<Hex | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [authAction, setAuthAction] = useState<'sign-in' | 'register' | null>(null);
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fee currency selection (default USDT, then USDC, cUSD, ...)
  const [feeSymbol, setFeeSymbol] = useState('USDT');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState('USDT');
  const [sending, setSending] = useState(false);

  const chainId = IS_MAINNET ? CELO_MAINNET_ID : CELO_SEPOLIA_ID;
  const chainLabel = IS_MAINNET ? 'Celo' : 'Celo Sepolia';
  const addr = wallet?.address;
  const fees = feeCurrenciesFor(chainId);

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

  async function refreshSession() {
    try {
      const res = await authClient.getSession();
      const next = (res?.data as { user?: SessionUser } | null)?.user ?? null;
      setUser(next);
      onSessionChange?.(next);
      if (next) {
        await resolveWalletForUser(next.id);
      } else {
        setPhase('signed-out');
        setWallet(null);
        setUnlockedKey(null);
      }
    } catch (sessionError) {
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

  async function handleCreateWallet() {
    if (!passphrase || passphrase.length < 8) {
      setError('Choose a recovery passphrase (min 8 chars) to encrypt your wallet key.');
      return;
    }
    try {
      const { address, privateKey } = createEOA();
      const encryptedPrivateKey = await encryptWithPassphrase(passphrase, privateKey);
      const recoverySecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const encryptedRecovery = await encryptWithPassphrase(passphrase, recoverySecret);
      const local: LocalWallet = {
        address,
        encryptedPrivateKey,
        recoverySecret: encryptedRecovery,
        backupConsent: false,
        createdAt: Date.now(),
      };
      await saveLocalWallet(local);
      setWallet(local);
      setPhase('ready');
      setError('');
      setPassphrase('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your wallet');
    }
  }

  async function handleUnlock() {
    if (!wallet) return;
    if (!passphrase) {
      setError('Enter your recovery passphrase to unlock and sign.');
      return;
    }
    try {
      const local = await loadLocalWallet(wallet.address);
      if (!local) throw new Error('Wallet not found on this device');
      const privateKey = (await decryptWithPassphrase(passphrase, local.encryptedPrivateKey)) as Hex;
      setUnlockedKey(privateKey);
      setError('');
      setPassphrase('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wrong passphrase or could not unlock');
    }
  }

  async function handleBackup(consent: boolean) {
    if (!wallet || !consent) {
      setWallet(wallet ? { ...wallet, backupConsent: false } : null);
      return;
    }
    if (!passphrase) {
      setError('Enter your recovery passphrase to encrypt the backup.');
      return;
    }
    setBackupSaving(true);
    setError('');
    try {
      const ref = await uploadEncryptedBackup(wallet.address, wallet.encryptedPrivateKey);
      await saveLocalWallet({ ...wallet, backupConsent: true, backupRef: ref });
      setWallet({ ...wallet, backupConsent: true, backupRef: ref });
      setBackupDone(true);
      setPassphrase('');
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
    const token = sendToken === 'CELO' ? null : fees.find((f) => f.symbol === sendToken);
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
      if (token) {
        const amount = parseUnits(sendAmount, token.decimals);
        await client.writeContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [sendTo as Address, amount],
          ...(feeCurrency ? { gasCurrency: feeCurrency as Address } : {}),
        } as any);
      } else {
        const amount = parseUnits(sendAmount, 18);
        await client.sendTransaction({
          to: sendTo as Address,
          value: amount,
          ...(feeCurrency ? { gasCurrency: feeCurrency as Address } : {}),
        } as any);
      }
      setError('');
      setSendAmount('');
      setSendTo('');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const initials = useMemo(() => getInitials(user?.name || user?.email || 'You') || 'YOU', [user]);

  if (sessionLoading) {
    return <p className="you-note">Loading your identity…</p>;
  }

  if (!user) {
    return (
      <div className="you-connect">
        <p className="you-sheet-lede">
          Sign in with a passkey to open your profile. You can set up your wallet after signing in.
        </p>
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
          onClick={async () => {
            setError('');
            setAuthAction('register');
            try {
              const result = await authClient.passkey.addPasskey({ name: 'DEVCITY wallet', createSession: true });
              if (result.error) throw new Error(result.error.message || 'Could not create account');
              await refreshSession();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : 'Could not create account');
            } finally {
              setAuthAction(null);
            }
          }}
        >
          {authAction === 'register' ? 'Waiting for passkey…' : 'Create an account with passkey'}
        </button>
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">{chainLabel} · passkey wallet · your key stays encrypted</p>
      </div>
    );
  }

  if (phase === 'registering') {
    return (
      <div className="you-connect">
        <p className="you-sheet-lede">
          Create your on-chain wallet. Pick a recovery passphrase — it encrypts your private key on this device (and optionally in the cloud).
        </p>
        <input
          type="password"
          className="you-passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Recovery passphrase"
          aria-label="Recovery passphrase"
        />
        <button className="you-connect-primary" onClick={handleCreateWallet}>
          Create wallet
        </button>
        {error && <p className="you-error">{error}</p>}
        <p className="you-note">The server never sees this passphrase or your private key.</p>
      </div>
    );
  }

  return (
    <div className="you-profile">
      <div className="you-identity">
        <div className="you-avatar you-avatar-lg you-avatar-initials">
          <span>{initials}</span>
        </div>
        <div className="you-identity-text">
          <strong>{user.name || 'You'}</strong>
          <button
            className="you-address"
            onClick={async () => {
              if (!wallet) return;
              await navigator.clipboard.writeText(wallet.address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : '—'} {copied ? '· copied' : ''}
          </button>
          <span className="you-chain">{chainLabel} · fee: {feeSymbol}</span>
        </div>
      </div>

      {/* Balances */}
      <div className="you-section">
        <h3 className="you-section-title">Balances</h3>
        <div className="wallet-balances">
          <div className="wallet-balance-row">
            <span>CELO</span>
            <strong>{Number(celoBalance?.value ?? BigInt(0)) / 10 ** (celoBalance?.decimals ?? 18) > 0 ? (Number(celoBalance?.value ?? BigInt(0)) / 10 ** (celoBalance?.decimals ?? 18)).toFixed(4) : '0.0000'}</strong>
          </div>
          {(['USDT', 'USDC', 'cUSD'] as const).map((sym) => (
            <div className="wallet-balance-row" key={sym}>
              <span>{sym}</span>
              <strong>{stableBalances[sym].toFixed(sym === 'cUSD' ? 4 : 2)}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Fee currency */}
      <div className="you-section">
        <h3 className="you-section-title">Pay gas with</h3>
        <div className="fee-currency-row">
          {fees.map((f) => (
            <button
              key={f.symbol}
              className={`fee-currency-chip${feeSymbol === f.symbol ? ' is-selected' : ''}`}
              onClick={() => setFeeSymbol(f.symbol)}
            >
              {f.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Unlock */}
      {!unlockedKey ? (
        <div className="you-section">
          <h3 className="you-section-title">Unlock to sign</h3>
          <input
            type="password"
            className="you-passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Recovery passphrase"
            aria-label="Recovery passphrase"
          />
          <button className="you-connect-primary" onClick={handleUnlock}>Unlock wallet</button>
        </div>
      ) : (
        <div className="you-section">
          <h3 className="you-section-title">Send</h3>
          <input
            className="you-passphrase"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="0x recipient"
            aria-label="Recipient"
          />
          <div className="fee-currency-row">
            <input
              className="you-passphrase send-amount"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="Amount"
              inputMode="decimal"
              aria-label="Amount"
            />
            <select
              className="send-token-select"
              value={sendToken}
              onChange={(e) => setSendToken(e.target.value)}
            >
              <option value="CELO">CELO</option>
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
              <option value="cUSD">cUSD</option>
            </select>
          </div>
          <button className="you-connect-primary" disabled={sending} onClick={handleSend}>
            {sending ? 'Sending…' : `Send (gas: ${feeSymbol})`}
          </button>
        </div>
      )}

      {/* Backup */}
      <div className="you-section">
        <h3 className="you-section-title">Encrypted cloud backup</h3>
        <p className="profile-control-hint">
          Your private key is encrypted on this device. Optionally back up the encrypted key so you can restore on a new device. The server stores only ciphertext.
        </p>
        <label className="you-checkbox">
          <input
            type="checkbox"
            checked={wallet?.backupConsent ?? false}
            onChange={(e) => void handleBackup(e.target.checked)}
          />
          <span>Save an encrypted backup for me</span>
        </label>
        {backupSaving && <p className="you-note">Encrypting & uploading…</p>}
        {backupDone && <p className="you-note">Backup saved. Restore on a new device with your passphrase.</p>}
      </div>

      {error && <p className="you-error">{error}</p>}

      <button
        className="you-disconnect"
        onClick={() => {
          authClient.signOut();
          setUser(null);
          onSessionChange?.(null);
          setWallet(null);
          setUnlockedKey(null);
          setPhase('signed-out');
        }}
      >
        Sign out
      </button>
    </div>
  );
}
