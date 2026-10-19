'use client';

import { useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { encodeFunctionData, getAddress, isAddress, createWalletClient, http, parseUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC20_ABI } from '@/lib/chain';
import { ACTIVE_CHAIN } from '@/lib/celo';
import { sendTransactionWithFee, writeContractWithFee, type TxRequest } from '@/lib/gas';
import { useFeeQuote } from '../../hooks/useFeeQuote';
import { FeePreview } from './FeePreview';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { clearUnlockedWallet, rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import { useUnlockedKey } from '../../hooks/useUnlockedKey';
import { UnlockSecret } from '../PinBoxes';
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
  setFeeSymbol?: (symbol: string) => void;
  initialToken?: string;
  chainLabel: string;
  availableBySymbol?: Record<string, string | null>;
  notify?: (message: string) => void;
}

export function WalletSendTab({ address, pinProtected, unlockedKey, fees, importedTokens, feeSymbol, initialToken, chainLabel, availableBySymbol, notify }: WalletSendTabProps) {
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState(initialToken || 'USDT');
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedTo, setResolvedTo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');
  const [explorer, setExplorer] = useState('');
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const sessionKey = useUnlockedKey(address);
  const effectiveKey = unlockedKey ?? sessionKey ?? localKey;
  const customToken = importedTokens.find((item) => sendToken === `CUSTOM:${item.address}`);
  const token = sendToken === 'CELO' ? null : fees.find((f) => f.symbol === sendToken) ?? customToken;
  const sendTokenLabel = customToken?.symbol ?? sendToken;
  const feeRequest = useMemo<TxRequest | null>(() => {
    if (!isAddress(sendTo) || !sendAmount || Number(sendAmount) <= 0) return null;
    if (token) {
      return {
        to: token.address,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(sendTo), parseUnits(sendAmount, token.decimals)],
        }),
      };
    }
    return { to: getAddress(sendTo), value: parseUnits(sendAmount, 18) };
  }, [sendAmount, sendTo, token]);
  const feePrefer = feeSymbol === 'auto' ? undefined : feeSymbol;
  const networkFee = useFeeQuote(address, feeRequest, feePrefer);

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
      let txHash: Hex;
      if (token) {
        const amount = parseUnits(sendAmount, token.decimals);
        txHash = await writeContractWithFee(client, {
          account,
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(toAddress), amount],
        }, { preferSymbol: feePrefer });
      } else {
        const amount = parseUnits(sendAmount, 18);
        txHash = await sendTransactionWithFee(client, {
          account,
          to: getAddress(toAddress),
          value: amount,
        }, { preferSymbol: feePrefer });
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

  async function openReview() {
    if (!sendTo.trim() || !sendAmount || Number(sendAmount) <= 0) {
      setError('Enter a recipient and an amount greater than zero.');
      return;
    }
    if (sendToken !== 'CELO' && !token) {
      setError('Select a token supported on this network.');
      return;
    }
    setResolving(true);
    setError('');
    try {
      const entered = sendTo.trim();
      if (isAddress(entered)) {
        setResolvedTo(getAddress(entered));
      } else {
        const resolved = await resolveRecipient(entered);
        if (!resolved) throw new Error('Could not find that DEVCITY username.');
        setResolvedTo(resolved.address);
      }
      setReviewing(true);
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : 'Check the recipient and try again.');
    } finally {
      setResolving(false);
    }
  }

  const available = availableBySymbol?.[sendToken] ?? null;

  return (
    <section className="wallet-action-panel" aria-labelledby="wallet-send-title">
      <div className="wallet-section-heading">
        <h3 id="wallet-send-title" className="wact-sr">Send from this wallet</h3>
      </div>
      {!effectiveKey ? (
        <div className="wallet-unlock">
          <p>Unlock to review and send a transaction.</p>
          <UnlockSecret id="wallet-send-pin" pinProtected={pinProtected} value={pin} onChange={setPin} />
          <Button className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
            <KeyRound size={16} /> Unlock wallet
          </Button>
          {error && <p className="you-error" role="alert">{error}</p>}
        </div>
      ) : hash ? (
        <div className="wsend-review" role="status">
          <h3>Submitted</h3>
          <p>The network has the transaction. It is not confirmed until the explorer shows it in a block.</p>
          <p className="wallet-transaction-status">
            <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…{hash.slice(-6)}</a>
          </p>
          <Button type="button" variant="outline" onClick={() => { setHash(''); setReviewing(false); }}>Done</Button>
        </div>
      ) : reviewing ? (
        <div className="wsend-review">
          <h3>Review</h3>
          <dl className="wact-facts">
            <div><dt>To</dt><dd>{resolvedTo}</dd></div>
            <div><dt>Amount</dt><dd>{sendAmount} {sendTokenLabel}</dd></div>
            <div><dt>Network</dt><dd>{chainLabel}</dd></div>
          </dl>
          <FeePreview quote={networkFee.quote} error={networkFee.error} loading={networkFee.loading} />
          <p className="wallet-send-caution">Check the recipient and network carefully. Transactions can’t be reversed.</p>
          <div className="wsend-review-actions">
            <Button type="button" variant="outline" disabled={sending} onClick={() => setReviewing(false)}>Back</Button>
            <Button type="button" className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={sending || Boolean(networkFee.error)} onClick={() => void handleSend()}>
              {sending ? 'Sending…' : 'Confirm'}
            </Button>
          </div>
          {error && <p className="you-error" role="alert">{error}</p>}
        </div>
      ) : (
        <>
          <label className="wallet-field-label" htmlFor="wallet-send-token">Token</label>
          <select
            id="wallet-send-token"
            className="you-passphrase send-token-select"
            value={sendToken}
            onChange={(e) => setSendToken(e.target.value)}
          >
            <option value="CELO">CELO</option>
            {fees.map((fee) => <option key={fee.symbol} value={fee.symbol}>{fee.symbol}</option>)}
            {importedTokens.map((custom) => (
              <option key={custom.address} value={`CUSTOM:${custom.address}`}>
                {custom.symbol} · {custom.name}
              </option>
            ))}
          </select>
          <label className="wallet-field-label" htmlFor="wallet-send-recipient">To</label>
          <input
            id="wallet-send-recipient"
            className="you-passphrase"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="0x… or username"
            autoComplete="off"
            aria-invalid={Boolean(error && !sendTo)}
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
              aria-invalid={Boolean(error && (!sendAmount || Number(sendAmount) <= 0))}
            />
            <span className="wsend-unit">{sendTokenLabel}</span>
          </div>
          <p className="wsend-available">
            {available ? <>Available {available} {sendTokenLabel}</> : 'Available balance still loading, or this token has no balance yet.'}
            <button
              type="button"
              disabled={!available}
              onClick={() => { if (available) setSendAmount(available); }}
            >
              Max
            </button>
          </p>
          <FeePreview quote={networkFee.quote} error={networkFee.error} loading={networkFee.loading} />
          <p className="wallet-send-caution">
            {feeSymbol === 'auto'
              ? 'The network fee is separate from this transfer. It is paid in CELO when you have it, otherwise USDT, then USDC, then another fee currency you hold.'
              : `The network fee is separate from this transfer. It tries ${feeSymbol} first. If that balance cannot cover the fee, it falls back to CELO, then USDT, then USDC.`}
          </p>
          <Button
            type="button"
            className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]"
            disabled={resolving || !sendTo || !sendAmount}
            onClick={() => void openReview()}
          >
            {resolving ? 'Checking…' : 'Continue'}
          </Button>
          {error && <p className="you-error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
