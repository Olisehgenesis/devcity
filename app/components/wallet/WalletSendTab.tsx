'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getAddress, isAddress, createWalletClient, http, parseUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC20_ABI } from '@/lib/chain';
import { ACTIVE_CHAIN, toGasCurrency } from '@/lib/celo';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { clearUnlockedWallet, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { resolveRecipient } from '../../lib/resolve-user';
import type { ImportedWalletToken } from '@/lib/wallet-assets';

interface Fee {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

interface WalletSendTabProps {
  address: string;
  pinProtected?: boolean;
  unlockedKey: Hex | null;
  fees: Fee[];
  importedTokens: ImportedWalletToken[];
  feeSymbol: string;
  setFeeSymbol: (symbol: string) => void;
  notify?: (message: string) => void;
}

export function WalletSendTab({ address, pinProtected, unlockedKey, fees, importedTokens, feeSymbol, notify }: WalletSendTabProps) {
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState('USDT');
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');
  const [explorer, setExplorer] = useState('');
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const effectiveKey = unlockedKey ?? localKey;
  const customToken = importedTokens.find((item) => sendToken === `CUSTOM:${item.address}`);
  const token = sendToken === 'CELO' ? null : fees.find((f) => f.symbol === sendToken) ?? customToken;
  const sendTokenLabel = customToken?.symbol ?? sendToken;

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

  async function handleSend() {
    if (!effectiveKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) {
      setError('Enter a recipient and amount.');
      return;
    }
    if (sendToken !== 'CELO' && !token) {
      setError('Select a token supported on this network.');
      return;
    }
    setSending(true);
    setError('');
    try {
      // Accept a 0x address OR a DEVCITY username/handle.
      let toAddress = sendTo.trim();
      if (!isAddress(toAddress)) {
        const resolved = await resolveRecipient(toAddress);
        if (!resolved) throw new Error('Could not find that DEVCITY username.');
        toAddress = resolved.address;
      }
      const account = privateKeyToAccount(effectiveKey);
      const client = createWalletClient({
        account,
        chain: ACTIVE_CHAIN,
        transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
      });
      const gasCurrency = toGasCurrency(ACTIVE_CHAIN.id, feeSymbol);
      let txHash: Hex;
      if (token) {
        const amount = parseUnits(sendAmount, token.decimals);
        txHash = await client.writeContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(toAddress), amount],
          ...(gasCurrency ? { gasCurrency: gasCurrency as Address } : {}),
        } as any);
      } else {
        const amount = parseUnits(sendAmount, 18);
        txHash = await client.sendTransaction({
          to: getAddress(toAddress),
          value: amount,
          ...(gasCurrency ? { gasCurrency: gasCurrency as Address } : {}),
        } as any);
      }
      setHash(txHash);
      setExplorer(ACTIVE_CHAIN.blockExplorers?.default.url ?? '');
      setSendAmount('');
      setSendTo('');
      notify?.('Transaction submitted.');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="wallet-action-panel" aria-labelledby="wallet-send-title">
      <div className="wallet-section-heading">
        <h3 id="wallet-send-title">Send from this wallet</h3>
      </div>
      {!effectiveKey ? (
        <div className="wallet-unlock">
          <p>Unlock to review and send a transaction.</p>
          <input
            type="password"
            className="you-passphrase"
            value={pin}
            onChange={(e) => setPin(pinProtected ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
            placeholder={pinProtected ? '6-digit wallet PIN' : 'Wallet passphrase'}
            aria-label={pinProtected ? '6-digit wallet PIN' : 'Wallet passphrase'}
            inputMode={pinProtected ? 'numeric' : undefined}
            maxLength={pinProtected ? 6 : undefined}
            autoComplete="current-password"
          />
          <button className="you-connect-primary" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
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
            placeholder="0x… or username"
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
            {sending ? 'Sending…' : `Send ${sendTokenLabel}`}
          </button>
        </>
      )}
      {hash && <p className="wallet-transaction-status" role="status">Transaction submitted: <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…</a></p>}
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
