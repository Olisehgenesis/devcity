'use client';

import { useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { createWalletClient, createPublicClient, encodeFunctionData, http, type Address, type Hex } from 'viem';
import { writeContractWithFee, type TxRequest } from '@/lib/gas';
import { useFeeQuote } from '../../hooks/useFeeQuote';
import { FeePreview } from './FeePreview';
import { privateKeyToAccount } from 'viem/accounts';
import { CELO_SEPOLIA, CHAIN } from '@/lib/chain';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { useUnlockedKey } from '../../hooks/useUnlockedKey';
import { UnlockSecret } from '../PinBoxes';

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'createToken', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'symbol', type: 'string' }, { name: 'tokenURI', type: 'string' }], outputs: [{ type: 'address' }] },
] as const;

interface WalletTokenTabProps {
  address: string;
  pinProtected?: boolean;
  unlockedKey: Hex | null;
  handle: string;
  handleTicker: string;
  notify?: (message: string) => void;
}

export function WalletTokenTab({ address, pinProtected, unlockedKey, handle, handleTicker, notify }: WalletTokenTabProps) {
  const [launching, setLaunching] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');
  const [token, setToken] = useState<{ address: string; name: string; symbol: string } | null>(null);
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const sessionKey = useUnlockedKey(address);
  const effectiveKey = unlockedKey ?? sessionKey ?? localKey;
  const tokenName = `${handle}.devcity.fun`;
  const feeRequest = useMemo<TxRequest>(() => ({
    to: CELO_SEPOLIA.profileTokenFactory as Address,
    data: encodeFunctionData({
      abi: PROFILE_FACTORY_ABI,
      functionName: 'createToken',
      args: [tokenName, handleTicker, ''],
    }),
  }), [handleTicker, tokenName]);
  const networkFee = useFeeQuote(effectiveKey ? address : null, feeRequest);

  async function handleUnlock() {
    if (!pin) {
      setError(pinProtected ? 'Enter your 6-digit wallet PIN.' : 'Enter your wallet passphrase.');
      return;
    }
    try {
      const local = await loadLocalWallet(address as Address);
      if (!local) throw new Error('Wallet not found on this device');
      const privateKey = (await decryptWithPassphrase(pin, local.encryptedPrivateKey)) as Hex;
      setLocalKey(privateKey);
      rememberUnlockedWallet(local.address, privateKey);
      setError('');
      setPin('');
    } catch {
      setError(pinProtected ? 'Incorrect wallet PIN.' : 'Wrong wallet passphrase.');
    }
  }

  async function handleLaunch() {
    if (!effectiveKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (token) {
      setError('You already have a profile token.');
      return;
    }
    setLaunching(true);
    setError('');
    try {
      const account = privateKeyToAccount(effectiveKey);
      const client = createWalletClient({
        account,
        chain: CHAIN,
        transport: http(CELO_SEPOLIA.rpcUrl),
      });
      const txHash = await writeContractWithFee(client, {
        account,
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'createToken',
        args: [tokenName, handleTicker, ''],
      });
      const publicClient = createPublicClient({
        chain: CHAIN,
        transport: http(CELO_SEPOLIA.rpcUrl),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') throw new Error('Token launch transaction reverted.');
      const tokenAddress = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'getUserToken',
        args: [address as Address],
      });
      await fetch('/api/profile-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAddress: address,
          name: tokenName,
          symbol: handleTicker,
          contractAddress: tokenAddress as string,
          chainId: CHAIN.id,
          maxSupply: '1000000',
        }),
      }).catch(() => {});
      setToken({ address: tokenAddress as string, name: tokenName, symbol: handleTicker });
      setHash(txHash);
      notify?.(`${handleTicker} profile token launched.`);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Token launch failed.');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <section className="wallet-action-panel" aria-labelledby="wallet-token-title">
      <div className="wallet-section-heading">
        <h3 id="wallet-token-title">Your profile token</h3>
      </div>
      <p className="wallet-send-caution">
        Launch a fixed-supply token for your handle. Name <strong>{tokenName}</strong> with ticker <strong>{handleTicker}</strong>. Requires a {CHAIN.name} transaction.
      </p>
      {token ? (
        <div className="wallet-token-row">
          <span className="wallet-token-mark">{token.symbol.slice(0, 1)}</span>
          <span className="wallet-token-name"><strong>{token.name}</strong><small>{token.address.slice(0, 10)}…{token.address.slice(-6)}</small></span>
          <strong className="wallet-token-balance">Live</strong>
        </div>
      ) : (
        <>
          {!effectiveKey ? (
            <div className="wallet-unlock">
              <p>Unlock to launch your profile token.</p>
              <UnlockSecret id="wallet-token-pin" pinProtected={pinProtected} value={pin} onChange={setPin} />
              <button className="you-connect-primary" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
                <KeyRound size={16} /> Unlock wallet
              </button>
            </div>
          ) : (
            <>
              <FeePreview quote={networkFee.quote} error={networkFee.error} loading={networkFee.loading} />
              <button className="you-connect-primary" disabled={launching || Boolean(networkFee.error)} onClick={() => void handleLaunch()}>
                {launching ? 'Launching…' : `Launch ${handleTicker} token`}
              </button>
            </>
          )}
        </>
      )}
      {hash && <p className="wallet-transaction-status" role="status">Transaction submitted: <a href={`${CELO_SEPOLIA.blockExplorer}/tx/${hash}`} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…</a></p>}
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
