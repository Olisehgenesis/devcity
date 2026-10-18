'use client';

import { useMemo, useState } from 'react';
import { Heart, KeyRound } from 'lucide-react';
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
import type { ImportedWalletToken } from '@/lib/wallet-assets';

interface Fee {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

interface WalletTipTabProps {
  address: string;
  pinProtected?: boolean;
  unlockedKey: Hex | null;
  fees: Fee[];
  importedTokens: ImportedWalletToken[];
  notify?: (message: string) => void;
}

export function WalletTipTab({ address, pinProtected, unlockedKey, fees, importedTokens, notify }: WalletTipTabProps) {
  const [tipTo, setTipTo] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [tipToken, setTipToken] = useState('USDT');
  const [tipping, setTipping] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');
  const [explorer, setExplorer] = useState('');
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const sessionKey = useUnlockedKey(address);
  const effectiveKey = unlockedKey ?? sessionKey ?? localKey;
  const token = tipToken === 'CELO' ? null : fees.find((f) => f.symbol === tipToken) ?? importedTokens.find((item) => tipToken === `CUSTOM:${item.address}`);
  const feeRequest = useMemo<TxRequest | null>(() => {
    if (!isAddress(tipTo) || !tipAmount || Number(tipAmount) <= 0) return null;
    if (token) {
      return {
        to: token.address,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(tipTo), parseUnits(tipAmount, token.decimals)],
        }),
      };
    }
    return { to: getAddress(tipTo), value: parseUnits(tipAmount, 18) };
  }, [tipAmount, tipTo, token]);
  const networkFee = useFeeQuote(address, feeRequest);

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

  async function handleTip() {
    if (!effectiveKey) {
      setError('Unlock your wallet first.');
      return;
    }
    if (!isAddress(tipTo)) {
      setError('Enter a valid recipient address.');
      return;
    }
    if (!tipTo || !tipAmount || Number(tipAmount) <= 0) {
      setError('Enter a recipient and amount.');
      return;
    }
    if (tipToken !== 'CELO' && !token) {
      setError('Select a token supported on this network.');
      return;
    }
    setTipping(true);
    setError('');
    try {
      const account = privateKeyToAccount(effectiveKey);
      const client = createWalletClient({
        account,
        chain: ACTIVE_CHAIN,
        transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
      });
      let txHash: Hex;
      if (token) {
        const amount = parseUnits(tipAmount, token.decimals);
        txHash = await writeContractWithFee(client, {
          account,
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [getAddress(tipTo), amount],
        });
      } else {
        const amount = parseUnits(tipAmount, 18);
        txHash = await sendTransactionWithFee(client, {
          account,
          to: getAddress(tipTo),
          value: amount,
        });
      }
      try {
        await fetch('/api/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAddress: address,
            toAddress: getAddress(tipTo),
            tokenSymbol: token ? token.symbol : 'CELO',
            amount: tipAmount,
            message: 'Wallet tip',
          }),
        });
      } catch {
        // DB tip record is best-effort.
      }
      setHash(txHash);
      setExplorer(ACTIVE_CHAIN.blockExplorers?.default.url ?? '');
      setTipAmount('');
      setTipTo('');
      notify?.('Tip sent.');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Tip failed');
    } finally {
      setTipping(false);
    }
  }

  return (
    <section className="wallet-action-panel" aria-labelledby="wallet-tip-title">
      <div className="wallet-section-heading">
        <h3 id="wallet-tip-title">Tip someone</h3>
      </div>
      {!effectiveKey ? (
        <div className="wallet-unlock">
          <p>Unlock to review and send a tip.</p>
          <UnlockSecret id="wallet-tip-pin" pinProtected={pinProtected} value={pin} onChange={setPin} />
          <button className="you-connect-primary" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
            <KeyRound size={16} /> Unlock wallet
          </button>
        </div>
      ) : (
        <>
          <label className="wallet-field-label" htmlFor="wallet-tip-recipient">Recipient address</label>
          <input
            id="wallet-tip-recipient"
            className="you-passphrase"
            value={tipTo}
            onChange={(e) => setTipTo(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
          />
          <label className="wallet-field-label" htmlFor="wallet-tip-amount">Amount</label>
          <div className="wallet-send-amount-row">
            <input
              id="wallet-tip-amount"
              className="you-passphrase"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
            <select
              className="send-token-select"
              value={tipToken}
              onChange={(e) => setTipToken(e.target.value)}
              aria-label="Token to tip"
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
          <FeePreview quote={networkFee.quote} error={networkFee.error} loading={networkFee.loading} />
          <p className="wallet-send-caution">A tip is a real transfer. Confirm the recipient address before sending. Gas is paid in CELO, then USDT, then USDC.</p>
          <button className="you-connect-primary" disabled={tipping || !tipTo || !tipAmount || networkFee.loading || Boolean(networkFee.error)} onClick={() => void handleTip()}>
            <Heart size={16} /> {tipping ? 'Tipping…' : 'Send tip'}
          </button>
        </>
      )}
      {hash && <p className="wallet-transaction-status" role="status">Transaction submitted: <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…</a></p>}
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
