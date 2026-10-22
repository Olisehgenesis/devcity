'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { Button } from '@/components/ui/button';
import { writeFeePreference } from '@/lib/fee-preference';
import type { LocalWallet } from '@/lib/keystore';
import { WalletSecurityTab } from './WalletSecurityTab';

interface FeeChoice {
  symbol: string;
  name: string;
}

interface WalletSettingsProps {
  accountName: string;
  chainLabel: string;
  address: string;
  fees: FeeChoice[];
  feeSymbol: string;
  onFeeSymbol: (symbol: string) => void;
  wallet: LocalWallet;
  unlockedKey: Hex | null;
  onWalletChange: (wallet: LocalWallet) => void;
  onUnlockKey: (key: Hex) => void;
  notify?: (message: string) => void;
  onSignOut: () => void;
  exporting: boolean;
  onExport: () => void;
  browserWallet?: { address: string; onDisconnect: () => void } | null;
}

export function WalletSettings({
  accountName,
  chainLabel,
  address,
  fees,
  feeSymbol,
  onFeeSymbol,
  wallet,
  unlockedKey,
  onWalletChange,
  onUnlockKey,
  notify,
  onSignOut,
  exporting,
  onExport,
  browserWallet,
}: WalletSettingsProps) {
  const [copied, setCopied] = useState(false);
  const [localHost, setLocalHost] = useState(false);
  useEffect(() => {
    setLocalHost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }, []);
  const [saveError, setSaveError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const choices: FeeChoice[] = [
    { symbol: 'auto', name: 'CELO when it covers the fee, then USDT, then USDC' },
    { symbol: 'CELO', name: 'Native token' },
    ...fees,
  ];

  function choose(symbol: string) {
    setSaveError('');
    try {
      writeFeePreference(symbol);
      onFeeSymbol(symbol);
    } catch {
      setSaveError('Could not save this preference on this device. The previous choice is still in use.');
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setSaveError('Could not copy the address.');
    }
  }

  return (
    <div className="wsettings">
      <section aria-labelledby="wallet-settings-network">
        <h2 id="wallet-settings-network">Network and wallet</h2>
        <p>This build uses {chainLabel}. The network cannot be switched from here.</p>
        <dl>
          <div><dt>Account</dt><dd>{accountName}</dd></div>
          <div><dt>Network</dt><dd>{chainLabel}</dd></div>
          <div><dt>Address</dt><dd className="wsettings-address">{address}</dd></div>
        </dl>
        <Button type="button" variant="outline" onClick={() => void copyAddress()}>{copied ? 'Copied' : 'Copy address'}</Button>
      </section>

      <section aria-labelledby="wallet-settings-fee">
        <h2 id="wallet-settings-fee">Network fee</h2>
        <p>This chooses the currency that pays gas on sends and tips from this device. It does not change the token, amount, or recipient of a transfer. A token in your holdings can pay gas only when it is a fee currency on {chainLabel}.</p>
        <div className="wsettings-fees" role="radiogroup" aria-label="Fee currency">
          {choices.map((choice) => {
            const selected = feeSymbol === choice.symbol;
            const label = choice.symbol === 'auto' ? 'Automatic' : choice.symbol;
            return (
              <button
                key={choice.symbol}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'is-selected' : ''}
                onClick={() => choose(choice.symbol)}
              >
                <span>
                  <strong>{label}</strong>
                  <small>{choice.name}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p>
          {feeSymbol === 'auto'
            ? 'If CELO cannot cover the fee, the wallet tries USDT, then USDC, then another fee currency you hold.'
            : `Sends and tips try ${feeSymbol} first. If that balance cannot cover the fee, the wallet falls back to CELO, then USDT, then USDC. The send screen says which currency the estimate used.`}
        </p>
        {saveError && <p className="you-error" role="alert">{saveError}</p>}
      </section>

      <section aria-labelledby="wallet-settings-security">
        <h2 id="wallet-settings-security">Security</h2>
        <WalletSecurityTab
          wallet={wallet}
          unlockedKey={unlockedKey}
          onWalletChange={onWalletChange}
          onUnlockKey={onUnlockKey}
          notify={notify}
        />
      </section>

      <section aria-labelledby="wallet-settings-data">
        <h2 id="wallet-settings-data">Your data</h2>
        <p>Download the profile, posts, tips, and claims stored for this wallet.</p>
        <Button type="button" variant="outline" disabled={exporting} onClick={onExport}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </Button>
        {localHost && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void fetch('/api/dev/faucet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true, address }),
              }).then(async (response) => {
                const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
                notify?.(data.message || data.error || (response.ok ? 'Faucet request sent.' : 'The test faucet could not send CELO.'));
              }).catch(() => notify?.('The test faucet could not send CELO.'));
            }}
          >
            Request test CELO
          </Button>
        )}
      </section>

      {browserWallet && (
        <section aria-labelledby="wallet-settings-browser">
          <h2 id="wallet-settings-browser">Browser wallet</h2>
          <p>A separate browser wallet is connected for trades that do not use this passkey wallet.</p>
          <p className="wsettings-address">{browserWallet.address}</p>
          <Button type="button" variant="outline" onClick={browserWallet.onDisconnect}>Disconnect</Button>
        </section>
      )}

      <section className="wsettings-account" aria-labelledby="wallet-settings-account">
        <h2 id="wallet-settings-account">Account</h2>
        <p>Signing out closes this wallet on this device. The encrypted copy stays in the browser.</p>
        {confirmSignOut ? (
          <div className="wsettings-confirm">
            <p>Sign out of {accountName}?</p>
            <Button type="button" className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" onClick={onSignOut}>Sign out</Button>
            <Button type="button" variant="outline" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setConfirmSignOut(true)}>Sign out</Button>
        )}
      </section>
    </div>
  );
}
