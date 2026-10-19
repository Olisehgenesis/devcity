'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ChevronDown, KeyRound } from 'lucide-react';
import { getAddress, parseUnits, type Hex } from 'viem';
import { Button } from '@/components/ui/button';
import { formatUsd } from '../../hooks/useUsdPrices';
import { useUnlockedKey } from '../../hooks/useUnlockedKey';
import { decryptWithPassphrase, loadLocalWallet } from '@/lib/keystore';
import { rememberUnlockedWallet } from '@/lib/unlocked-wallet';
import {
  executeSwap,
  formatTokenAmount,
  quoteIsFresh,
  quoteSwap,
  routeLabel,
  swapAsset,
  type SwapQuote,
} from '@/lib/swap';
import { UnlockSecret } from '../PinBoxes';
import { TokenMark } from './TokenMark';

export type SwapHolding = {
  symbol: string;
  name: string;
  amount: number | null;
  status: 'loading' | 'ready' | 'error';
  price: number | null;
};

const SLIPPAGE = ['0.1', '0.5', '1.0'] as const;

function amountText(token: SwapHolding) {
  if (token.amount == null) return '';
  const digits = token.symbol === 'CELO' || token.symbol === 'USDm' ? 4 : 2;
  return token.amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function WalletSwap({
  tokens,
  chainLabel,
  address,
  pinProtected,
  unlockedKey,
  feeSymbol,
  notify,
  onDone,
}: {
  tokens: SwapHolding[];
  chainLabel?: string;
  address: string;
  pinProtected?: boolean;
  unlockedKey: Hex | null;
  feeSymbol: string;
  notify?: (message: string) => void;
  onDone?: () => void;
}) {
  const choices = tokens.length > 0 ? tokens : [];
  const [fromSymbol, setFromSymbol] = useState(choices[0]?.symbol ?? 'CELO');
  const [toSymbol, setToSymbol] = useState(choices.find((token) => token.symbol !== choices[0]?.symbol)?.symbol ?? choices[1]?.symbol ?? 'USDm');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState<(typeof SLIPPAGE)[number]>('0.5');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [localKey, setLocalKey] = useState<Hex | null>(null);

  const sessionKey = useUnlockedKey(address);
  const mounted = useRef(true);
  const effectiveKey = unlockedKey ?? sessionKey ?? localKey;
  const from = choices.find((token) => token.symbol === fromSymbol) ?? choices[0];
  const to = choices.find((token) => token.symbol === toSymbol) ?? choices.find((token) => token.symbol !== from?.symbol) ?? choices[0];
  const fromAsset = from ? swapAsset(from.symbol) : null;
  const toAsset = to ? swapAsset(to.symbol) : null;
  const fromKey = fromAsset ? `${fromAsset.symbol}:${fromAsset.decimals}` : '';
  const toKey = toAsset ? `${toAsset.symbol}:${toAsset.decimals}` : '';
  const parsed = Number(amount);
  const fromQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const insufficient = from?.status === 'ready' && from.amount != null && fromQuantity != null && fromQuantity > from.amount;
  const slip = Number(slippage);
  const outText = quote && toAsset ? formatTokenAmount(quote.amountOut, toAsset.decimals) : '';
  const outQuantity = outText ? Number(outText) : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!fromAsset || !toAsset || !amount || Number(amount) <= 0 || insufficient) {
      setQuote(null);
      setQuoting(false);
      setQuoteError('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let amountIn: bigint;
      try {
        amountIn = parseUnits(amount, fromAsset.decimals);
      } catch {
        setQuote(null);
        setQuoteError('Enter an amount with fewer decimal places.');
        return;
      }
      setQuoting(true);
      setQuoteError('');
      void quoteSwap(fromAsset, toAsset, amountIn)
        .then((next) => {
          if (cancelled) return;
          setQuote(next);
          setQuoteError(next ? '' : `No Mento or Uniswap route for ${fromAsset.symbol} to ${toAsset.symbol}.`);
        })
        .catch(() => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError('The quote could not be loaded.');
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amount, fromKey, insufficient, toKey]);

  const feePrefer = feeSymbol === 'auto' ? undefined : feeSymbol;

  const rateLabel = useMemo(() => {
    if (!from || !to || !quote || !fromAsset || !toAsset || quote.amountIn <= BigInt(0)) return 'Unavailable';
    const input = Number(formatTokenAmount(quote.amountIn, fromAsset.decimals));
    const output = Number(formatTokenAmount(quote.amountOut, toAsset.decimals));
    if (!Number.isFinite(input) || input <= 0 || !Number.isFinite(output)) return 'Unavailable';
    const rate = output / input;
    const digits = rate >= 1 ? 4 : 6;
    return `1 ${from.symbol} = ${rate.toLocaleString(undefined, { maximumFractionDigits: digits })} ${to.symbol}`;
  }, [from, fromAsset, quoting, quote, to, toAsset]);

  function flip() {
    if (!from || !to) return;
    setFromSymbol(to.symbol);
    setToSymbol(from.symbol);
  }

  function choose(side: 'from' | 'to', symbol: string) {
    if (side === 'from') {
      if (symbol === to?.symbol && from) setToSymbol(from.symbol);
      setFromSymbol(symbol);
    } else {
      if (symbol === from?.symbol && to) setFromSymbol(to.symbol);
      setToSymbol(symbol);
    }
  }

  async function handleUnlock() {
    if (!pin) {
      setError(pinProtected ? 'Enter your 6-digit wallet PIN.' : 'Enter your wallet passphrase.');
      return;
    }
    try {
      const local = await loadLocalWallet(getAddress(address));
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

  async function confirm() {
    if (!quote || !effectiveKey) return;
    if (!quoteIsFresh(quote)) {
      setError('This quote expired. Wait for a new quote, then swap.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await executeSwap({
        quote: quote,
        privateKey: effectiveKey,
        recipient: getAddress(address),
        slippagePercent: slip,
        preferSymbol: feePrefer,
      });
      setAmount('');
      notify?.('Swap submitted.');
      if (mounted.current) onDone?.();
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Swap failed';
      if (mounted.current) {
        setError(message);
        setSending(false);
      } else {
        notify?.(message);
      }
    }
  }

  if (!from || !to) {
    return <p className="wact-empty">No tokens are available to swap yet.</p>;
  }

  const canSwap = Boolean(fromQuantity) && !insufficient && Boolean(quote) && !quoting && !sending;

  if (sending) {
    return <SwapProgress from={from.symbol} to={to.symbol} />;
  }

  return (
    <section className="wswap" aria-label="Swap">
      {chainLabel && <p className="wswap-network">{chainLabel}</p>}
      {!effectiveKey ? (
        <div className="wallet-unlock">
          <p>Unlock to quote and confirm a swap.</p>
          <UnlockSecret id="wallet-swap-pin" pinProtected={pinProtected} value={pin} onChange={setPin} />
          <Button className="border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]" disabled={!pin || Boolean(pinProtected && pin.length !== 6)} onClick={() => void handleUnlock()}>
            <KeyRound size={16} /> Unlock wallet
          </Button>
          {error && <p className="you-error" role="alert">{error}</p>}
        </div>
      ) : (
        <>
          <div className="wswap-card">
            <SwapSide
              label="From"
              token={from}
              tokens={choices}
              amount={amount}
              usd={from.price != null && fromQuantity != null ? formatUsd(fromQuantity * from.price) : null}
              editable
              onAmount={setAmount}
              onToken={(symbol) => choose('from', symbol)}
            />
            <button type="button" className="wswap-flip" onClick={flip} aria-label="Swap direction">
              <ArrowDownUp size={16} aria-hidden="true" />
            </button>
            <SwapSide
              label="To"
              token={to}
              tokens={choices}
              amount={outText}
              usd={to.price != null && outQuantity != null ? formatUsd(outQuantity * to.price) : ''}
              onToken={(symbol) => choose('to', symbol)}
            />
          </div>

          <dl className="wswap-facts">
            <div>
              <dt>Rate</dt>
              <dd>{rateLabel}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>{quote ? routeLabel(quote) : 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Slippage</dt>
              <dd>
                <span className="wswap-slip">
                  {SLIPPAGE.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={slippage === value ? 'is-active' : ''}
                      aria-pressed={slippage === value}
                      onClick={() => setSlippage(value)}
                    >
                      {value}%
                    </button>
                  ))}
                </span>
              </dd>
            </div>
          </dl>
          {quoteError && <p className="wswap-note">{quoteError}</p>}
          <Button
            type="button"
            className="wswap-preview w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]"
            disabled={!canSwap}
            onClick={() => void confirm()}
          >
            {insufficient ? 'Amount exceeds balance' : 'Swap'}
          </Button>
          {error && <p className="you-error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}

function SwapProgress({ from, to }: { from: string; to: string }) {
  return (
    <section className="swap-progress" role="status" aria-live="polite">
      <div className="swap-logo" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <p>Swapping {from} to {to}</p>
    </section>
  );
}

function SwapSide({
  label,
  token,
  tokens,
  amount,
  usd,
  editable,
  onAmount,
  onToken,
}: {
  label: string;
  token: SwapHolding;
  tokens: SwapHolding[];
  amount: string;
  usd: string | null;
  editable?: boolean;
  onAmount?: (value: string) => void;
  onToken: (symbol: string) => void;
}) {
  const id = `swap-${label.toLowerCase()}`;
  return (
    <div className="wswap-side">
      <label htmlFor={id}>{label}</label>
      <div className="wswap-line">
        <div className="wswap-token">
          <TokenMark symbol={token.symbol} />
          <select id={id} aria-label={`${label} token`} value={token.symbol} onChange={(event) => onToken(event.target.value)}>
            {tokens.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <div className="wswap-amt">
          {editable ? (
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => onAmount?.(event.target.value.replace(/[^\d.]/g, ''))}
              aria-label={`${label} amount`}
            />
          ) : (
            <strong>{amount || '—'}</strong>
          )}
          <small>
            {token.status === 'loading' && token.amount == null ? 'Loading…' : token.status === 'error' && token.amount == null ? 'Balance unavailable' : usd ?? 'Price unavailable'}
          </small>
        </div>
      </div>
      <p className="wswap-bal">
        {token.status === 'ready' && token.amount != null ? `Available ${amountText(token)}` : token.status === 'error' ? 'Balance unavailable' : ' '}
      </p>
    </div>
  );
}
