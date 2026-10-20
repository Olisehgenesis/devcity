'use client';

import { useMemo, useState } from 'react';
import { Heart, KeyRound } from 'lucide-react';
import { TokenMark } from './TokenMark';
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
  feeSymbol?: string;
  notify?: (message: string) => void;
}

export function WalletTipTab({ address, pinProtected, unlockedKey, fees, importedTokens, feeSymbol = 'auto', notify }: WalletTipTabProps) {
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
        }, { preferSymbol: feePrefer });
      } else {
        const amount = parseUnits(tipAmount, 18);
        txHash = await sendTransactionWithFee(client, {
          account,
          to: getAddress(tipTo),
          value: amount,
        }, { preferSymbol: feePrefer });
      }
      let recordError = '';
      try {
        const recorded = await fetch('/api/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAddress: address,
            toAddress: getAddress(tipTo),
            tokenSymbol: token ? token.symbol : 'CELO',
            amount: tipAmount,
            message: 'Wallet tip',
            txHash,
          }),
        });
        if (!recorded.ok) {
          const body = await recorded.json().catch(() => ({})) as { error?: string };
          recordError = body.error || 'The tip was sent. The city record could not be saved.';
        }
      } catch {
        recordError = 'The tip was sent. The city record could not be saved.';
      }
      setHash(txHash);
      setExplorer(ACTIVE_CHAIN.blockExplorers?.default.url ?? '');
      setTipAmount('');
      setTipTo('');
      if (recordError) setError(recordError);
      else notify?.('Tip sent.');
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
          <Button disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={handleUnlock}>
            <KeyRound size={16} /> Unlock wallet
          </Button>
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
            <span className="wtip-token">
              <TokenMark symbol={tipToken.startsWith('CUSTOM:') ? (importedTokens.find((item) => `CUSTOM:${item.address}` === tipToken)?.symbol ?? 'T') : tipToken} />
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
            </span>
          </div>
          <FeePreview quote={networkFee.quote} error={networkFee.error} loading={networkFee.loading} />
          <p className="wallet-send-caution">
            A tip is a real transfer. Confirm the recipient address before sending.
            {' '}
            {feeSymbol === 'auto'
              ? 'The network fee is paid in CELO when you have it, otherwise USDT, then USDC.'
              : `The network fee tries ${feeSymbol} first, then falls back if that balance cannot cover it.`}
          </p>
          <Button disabled={tipping || !tipTo || !tipAmount || Boolean(networkFee.error)} onClick={() => void handleTip()}>
            <Heart size={16} /> {tipping ? 'Tipping…' : 'Send tip'}
          </Button>
        </>
      )}
      {hash && <p className="wallet-transaction-status" role="status">Transaction submitted: <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…</a></p>}
      {error && <p className="you-error" role="alert">{error}</p>}
    </section>
  );
}
