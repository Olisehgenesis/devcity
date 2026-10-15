'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, Copy, KeyRound, LandPlot, ShieldCheck, Send as SendIcon, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { useBalance, useReadContract } from 'wagmi';
import { createWalletClient, createPublicClient, getAddress, http, isAddress, parseUnits } from 'viem';
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
  exportEncryptedKeystore,
  downloadEncryptedKeystore,
  readEncryptedKeystoreFile,
  importEncryptedKeystore,
  type LocalWallet,
  type EncryptedKeystoreFile,
} from '@/lib/keystore';
import { CELO_MAINNET_ID, CELO_SEPOLIA_ID, IS_MAINNET, ACTIVE_CHAIN, feeCurrenciesFor, toGasCurrency } from '@/lib/celo';
import { CELO_SEPOLIA, CHAIN, ERC20_ABI } from '@/lib/chain';
import type { Hex, Address } from 'viem';
import { WalletTokenTools } from './WalletTokenTools';
import { WalletTradeTab } from './wallet/WalletTradeTab';
import { WalletOverview } from './wallet/WalletOverview';
import { WalletAssetsTab } from './wallet/WalletAssetsTab';
import { WalletSendTab } from './wallet/WalletSendTab';
import { WalletTipTab } from './wallet/WalletTipTab';
import { WalletDropTab } from './wallet/WalletDropTab';
import { WalletTokenTab } from './wallet/WalletTokenTab';
import { WalletSecurityTab } from './wallet/WalletSecurityTab';
import type { ImportedWalletToken } from '@/lib/wallet-assets';

type Phase = 'signed-out' | 'registering' | 'ready' | 'restore' | 'backup-required';
type WalletTab = 'assets' | 'send' | 'tip' | 'drop' | 'token' | 'trade' | 'security';

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'createToken', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'symbol', type: 'string' }, { name: 'tokenURI', type: 'string' }], outputs: [{ type: 'address' }] },
] as const;

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
  const [tab, setTab] = useState<WalletTab>('assets');
  const [transactionHash, setTransactionHash] = useState('');
  const [transactionExplorer, setTransactionExplorer] = useState('');
  const [exportingKeystore, setExportingKeystore] = useState(false);
  const [importingKeystore, setImportingKeystore] = useState(false);
  const [keystoreFile, setKeystoreFile] = useState<EncryptedKeystoreFile | null>(null);
  const [keystorePassphrase, setKeystorePassphrase] = useState('');
  const [restoreAddress, setRestoreAddress] = useState<string | null>(null);

  // Fee currency selection (default USDT, then USDC, cUSD, ...)
  const [feeSymbol, setFeeSymbol] = useState('USDT');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState('USDT');
  const [sending, setSending] = useState(false);
  const [importedTokens, setImportedTokens] = useState<ImportedWalletToken[]>([]);
  const onImportedTokensChange = useCallback((tokens: ImportedWalletToken[]) => setImportedTokens(tokens), []);

  // Tip
  const [tipTo, setTipTo] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [tipToken, setTipToken] = useState('USDT');
  const [tipping, setTipping] = useState(false);

  // Create drop
  const [dropName, setDropName] = useState('');
  const [dropAmount, setDropAmount] = useState('');
  const [dropMaxClaimants, setDropMaxClaimants] = useState('100');
  const [dropEndsIn, setDropEndsIn] = useState('24');
  const [creatingDrop, setCreatingDrop] = useState(false);
  const [dropToken, setDropToken] = useState('USDT');

  // Profile token launch
  const [launchingToken, setLaunchingToken] = useState(false);
  const [launchedToken, setLaunchedToken] = useState<{ address: string; name: string; symbol: string } | null>(null);

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

  async function handleExportKeystore() {
    if (!wallet || !unlockedKey) {
      setError('Unlock your wallet before exporting.');
      return;
    }
    if (!keystorePassphrase) {
      setError('Choose a passphrase for the keystore file.');
      return;
    }
    setExportingKeystore(true);
    setError('');
    try {
      const file = await exportEncryptedKeystore(wallet.address, unlockedKey, keystorePassphrase);
      downloadEncryptedKeystore(file, wallet.address);
      setKeystorePassphrase('');
      onNotify?.('Encrypted keystore file downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export keystore.');
    } finally {
      setExportingKeystore(false);
    }
  }

  async function handleImportKeystore(file: File) {
    if (!user) return;
    setImportingKeystore(true);
    setError('');
    try {
      const parsed = await readEncryptedKeystoreFile(file);
      setKeystoreFile(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read keystore file.');
      setImportingKeystore(false);
    }
  }

  async function confirmImportKeystore() {
    if (!keystoreFile || !user) return;
    if (!keystorePassphrase) {
      setError('Enter the passphrase for this keystore file.');
      return;
    }
    setImportingKeystore(true);
    setError('');
    try {
      const { address, privateKey } = await importEncryptedKeystore(keystoreFile, keystorePassphrase);
      if (!/^0x[0-9a-f]{64}$/.test(privateKey)) {
        throw new Error('The imported keystore does not contain a valid private key.');
      }
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(privateKey as Hex);
      if (account.address.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Keystore address does not match its key.');
      }
      const encryptedPrivateKey = await encryptWithPassphrase(keystorePassphrase, privateKey);
      const local: LocalWallet = {
        address: account.address,
        name: `${normalizeUsername(user.name ?? '') ?? 'city-explorer'}.devcity.fun`,
        pinProtected: true,
        encryptedPrivateKey,
        backupConsent: false,
        createdAt: Date.now(),
      };
      await saveLocalWallet(local);
      setWallet(local);
      setPhase('ready');
      setKeystoreFile(null);
      setKeystorePassphrase('');
      onNotify?.('Wallet imported from keystore file.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import keystore.');
    } finally {
      setImportingKeystore(false);
    }
  }

  async function handleTip() {
    if (!wallet || !unlockedKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (!isAddress(tipTo)) {
      setError('Enter a valid recipient address.');
      return;
    }
    const token = tipToken === 'CELO'
      ? null
      : fees.find((f) => f.symbol === tipToken)
        ?? importedTokens.find((item) => tipToken === `CUSTOM:${item.address}`);
    if (tipToken !== 'CELO' && !token) {
      setError('Select a token supported on this network.');
      return;
    }
    if (!tipTo || !tipAmount || Number(tipAmount) <= 0) {
      setError('Enter a recipient and amount.');
      return;
    }
    setTipping(true);
    setError('');
    try {
      const account = privateKeyToAccount(unlockedKey);
      const client = createWalletClient({
        account,
        chain: ACTIVE_CHAIN,
        transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
      });
      const gasCurrency = toGasCurrency(chainId, feeSymbol);
      let hash: Hex;
      if (token) {
        const amount = parseUnits(tipAmount, token.decimals);
        hash = await client.writeContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(tipTo), amount],
          ...(gasCurrency ? { gasCurrency: gasCurrency as Address } : {}),
        } as any);
      } else {
        const amount = parseUnits(tipAmount, 18);
        hash = await client.sendTransaction({
          to: getAddress(tipTo),
          value: amount,
          ...(gasCurrency ? { gasCurrency: gasCurrency as Address } : {}),
        } as any);
      }
      try {
        await fetch('/api/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAddress: wallet.address,
            toAddress: getAddress(tipTo),
            tokenSymbol: token ? token.symbol : 'CELO',
            amount: tipAmount,
            message: 'Wallet tip',
          }),
        });
      } catch {
        // DB tip record is best-effort; the on-chain transfer already succeeded.
      }
      setError('');
      setTransactionHash(hash);
      setTransactionExplorer(ACTIVE_CHAIN.blockExplorers?.default.url ?? '');
      setTipAmount('');
      setTipTo('');
      onNotify?.('Tip sent.');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Tip failed');
    } finally {
      setTipping(false);
    }
  }

  async function handleCreateDrop() {
    if (!wallet || !unlockedKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (!dropName.trim()) {
      setError('Give the drop a name.');
      return;
    }
    if (!dropAmount || Number(dropAmount) <= 0) {
      setError('Enter a drop amount.');
      return;
    }
    const claimants = Number(dropMaxClaimants);
    if (!Number.isInteger(claimants) || claimants < 1) {
      setError('Enter a valid number of claimants.');
      return;
    }
    const hours = Number(dropEndsIn);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('Enter how many hours the drop lasts.');
      return;
    }
    const token = dropToken === 'CELO'
      ? null
      : fees.find((f) => f.symbol === dropToken) ?? importedTokens.find((item) => dropToken === `CUSTOM:${item.address}`);
    if (dropToken !== 'CELO' && !token) {
      setError('Select a token for the drop.');
      return;
    }
    setCreatingDrop(true);
    setError('');
    try {
      const now = Date.now();
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dropName.trim(),
          description: 'Drop created from your wallet.',
          tokenAddress: token ? token.address : '',
          amount: dropAmount,
          maxClaimants: claimants,
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + hours * 3600 * 1000).toISOString(),
          creatorAddress: wallet.address,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not create drop.');
      }
      setDropName('');
      setDropAmount('');
      onNotify?.('Drop created.');
    } catch (e: any) {
      setError(e?.message || 'Could not create drop.');
    } finally {
      setCreatingDrop(false);
    }
  }

  async function handleLaunchToken() {
    if (!wallet || !unlockedKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (launchedToken) {
      setError('You already have a profile token.');
      return;
    }
    setLaunchingToken(true);
    setError('');
    try {
      const name = `${handle}.devcity.fun`;
      const symbol = handleTicker;
      const account = privateKeyToAccount(unlockedKey);
      const client = createWalletClient({
        account,
        chain: CHAIN,
        transport: http(CELO_SEPOLIA.rpcUrl),
      });
      const hash = await client.writeContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'createToken',
        args: [name, symbol, ''],
      });
      const publicClient = createPublicClient({
        chain: CHAIN,
        transport: http(CELO_SEPOLIA.rpcUrl),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Token launch transaction reverted.');
      const tokenAddress = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'getUserToken',
        args: [wallet.address as Address],
      });
      await fetch('/api/profile-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAddress: wallet.address,
          name,
          symbol,
          contractAddress: tokenAddress as string,
          chainId: CHAIN.id,
          maxSupply: '1000000',
        }),
      }).catch(() => {});
      setLaunchedToken({ address: tokenAddress as string, name, symbol });
      setTransactionHash(hash);
      setTransactionExplorer(CELO_SEPOLIA.blockExplorer);
      onNotify?.(`${symbol} profile token launched.`);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Token launch failed.');
    } finally {
      setLaunchingToken(false);
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
