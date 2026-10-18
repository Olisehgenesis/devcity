'use client';

import { useState } from 'react';
import { LandPlot, KeyRound } from 'lucide-react';
import { getAddress, createWalletClient, http, parseUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC20_ABI } from '@/lib/chain';
import { ACTIVE_CHAIN, toGasCurrency } from '@/lib/celo';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { UnlockSecret } from '../PinBoxes';
import type { ImportedWalletToken } from '@/lib/wallet-assets';

interface Fee {
  symbol: string;
  address: Address;
  decimals: number;
}

interface WalletDropTabProps {
  address: string;
  pinProtected?: boolean;
  unlockedKey: Hex | null;
  fees: Fee[];
  importedTokens: ImportedWalletToken[];
  notify?: (message: string) => void;
}

export function WalletDropTab({ address, pinProtected, unlockedKey, fees, importedTokens, notify }: WalletDropTabProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [maxClaimants, setMaxClaimants] = useState('100');
  const [endsIn, setEndsIn] = useState('24');
  const [token, setToken] = useState('USDT');
  const [creating, setCreating] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const effectiveKey = unlockedKey ?? localKey;

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

  async function handleCreate() {
    if (!effectiveKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (!name.trim()) { setError('Give the drop a name.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a drop amount.'); return; }
    const claimants = Number(maxClaimants);
    if (!Number.isInteger(claimants) || claimants < 1) { setError('Enter a valid number of claimants.'); return; }
    const hours = Number(endsIn);
    if (!Number.isFinite(hours) || hours <= 0) { setError('Enter how many hours the drop lasts.'); return; }
    const chosenToken = token === 'CELO' ? null : fees.find((f) => f.symbol === token) ?? importedTokens.find((item) => token === `CUSTOM:${item.address}`);
    if (token !== 'CELO' && !chosenToken) { setError('Select a token for the drop.'); return; }
    setCreating(true);
    setError('');
    try {
      const now = Date.now();
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: 'Drop created from your wallet.',
          tokenAddress: chosenToken ? chosenToken.address : '',
          amount,
          maxClaim: claimants,
          maxClaimants: claimants,
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + hours * 3600 * 1000).toISOString(),
          creatorAddress: address,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not create drop.');
      }
      setName('');
      setAmount('');
      notify?.('Drop created.');
    } catch (e: any) {
      setError(e?.message || 'Could not create drop.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="wallet-action-panel" aria-labelledby="wallet-drop-title">
      <div className="wallet-section-heading">
        <h3 id="wallet-drop-title">Create a drop</h3>
      </div>
      {!effectiveKey ? (
        <div className="wallet-unlock">
          <p>Unlock to create a drop.</p>
          <UnlockSecret id="wallet-drop-pin" pinProtected={pinProtected} value={pin} onChange={setPin} />
          <button className="you-connect-primary" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
            <KeyRound size={16} /> Unlock wallet
          </button>
        </div>
      ) : (
        <>
          <label className="wallet-field-label" htmlFor="wallet-drop-name">Drop name</label>
          <input id="wallet-drop-name" className="you-passphrase" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome to the city" maxLength={60} />
          <div className="wallet-send-amount-row">
            <div style={{ flex: 1 }}>
              <label className="wallet-field-label" htmlFor="wallet-drop-amount">Amount per claimant</label>
              <input id="wallet-drop-amount" className="you-passphrase" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="wallet-field-label" htmlFor="wallet-drop-token">Token</label>
              <select className="send-token-select" id="wallet-drop-token" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token for the drop">
                <option value="CELO">CELO</option>
                {fees.map((fee) => <option key={fee.symbol} value={fee.symbol}>{fee.symbol}</option>)}
                {importedTokens.map((customToken) => (
                  <option key={customToken.address} value={`CUSTOM:${customToken.address}`}>
                    {customToken.symbol} · {customToken.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="wallet-send-amount-row">
            <div style={{ flex: 1 }}>
              <label className="wallet-field-label" htmlFor="wallet-drop-claimants">Max claimants</label>
              <input id="wallet-drop-claimants" className="you-passphrase" value={maxClaimants} onChange={(e) => setMaxClaimants(e.target.value)} placeholder="100" inputMode="numeric" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="wallet-field-label" htmlFor="wallet-drop-hours">Ends in (hours)</label>
              <input id="wallet-drop-hours" className="you-passphrase" value={endsIn} onChange={(e) => setEndsIn(e.target.value)} placeholder="24" inputMode="numeric" />
            </div>
          </div>
          <p className="wallet-send-caution">Drops make tokens claimable near the city. Create your token first, then drop it.</p>
          <button className="you-connect-primary" disabled={creating || !name || !amount} onClick={() => void handleCreate()}>
            <LandPlot size={16} /> {creating ? 'Creating…' : 'Create drop'}
          </button>
        </>
      )}
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
