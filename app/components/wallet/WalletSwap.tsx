'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatUsd } from '../../hooks/useUsdPrices';
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
  if (token.status === 'loading' && token.amount == null) return '';
  if (token.status === 'error' && token.amount == null) return '';
  if (token.amount == null) return '';
  const digits = token.symbol === 'CELO' || token.symbol === 'USDm' ? 4 : 2;
  return token.amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function usdText(token: SwapHolding, quantity: number | null) {
  if (token.price == null) return null;
  return formatUsd((quantity ?? 0) * token.price);
}

export function WalletSwap({ tokens, chainLabel }: { tokens: SwapHolding[]; chainLabel?: string }) {
  const choices = tokens.length > 0 ? tokens : [];
  const [fromSymbol, setFromSymbol] = useState(choices[0]?.symbol ?? 'CELO');
  const [toSymbol, setToSymbol] = useState(choices.find((token) => token.symbol !== choices[0]?.symbol)?.symbol ?? choices[1]?.symbol ?? 'USDm');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState<(typeof SLIPPAGE)[number]>('0.5');
  const [reviewing, setReviewing] = useState(false);

  const from = choices.find((token) => token.symbol === fromSymbol) ?? choices[0];
  const to = choices.find((token) => token.symbol === toSymbol) ?? choices.find((token) => token.symbol !== from?.symbol) ?? choices[0];

  const parsed = Number(amount);
  const fromQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const rate = from && to && from.price != null && to.price != null && to.price > 0 ? from.price / to.price : null;
  const toQuantity = fromQuantity != null && rate != null ? fromQuantity * rate : null;
  const slip = Number(slippage) / 100;
  const minimum = toQuantity != null ? toQuantity * (1 - slip) : null;
  const insufficient = from?.status === 'ready' && from.amount != null && fromQuantity != null && fromQuantity > from.amount;
  const canPreview = Boolean(fromQuantity) && !insufficient && rate != null && from?.status !== 'error';

  const rateLabel = useMemo(() => {
    if (!from || !to) return 'Unavailable';
    if (rate == null) return 'Unavailable';
    const digits = rate >= 1 ? 4 : 6;
    return `1 ${from.symbol} = ${rate.toLocaleString(undefined, { maximumFractionDigits: digits })} ${to.symbol}`;
  }, [from, rate, to]);

  function flip() {
    if (!from || !to) return;
    setFromSymbol(to.symbol);
    setToSymbol(from.symbol);
    setReviewing(false);
  }

  function choose(side: 'from' | 'to', symbol: string) {
    if (side === 'from') {
      if (symbol === to?.symbol && from) setToSymbol(from.symbol);
      setFromSymbol(symbol);
    } else {
      if (symbol === from?.symbol && to) setFromSymbol(to.symbol);
      setToSymbol(symbol);
    }
    setReviewing(false);
  }

  if (!from || !to) {
    return <p className="wact-empty">No tokens are available to swap yet.</p>;
  }

  return (
    <section className="wswap" aria-label="Swap">
      {chainLabel && <p className="wswap-network">{chainLabel}</p>}
      <div className="wswap-card">
        <SwapSide
          label="From"
          token={from}
          tokens={choices}
          amount={amount}
          usd={usdText(from, fromQuantity)}
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
          amount={toQuantity == null ? '' : toQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          usd={usdText(to, toQuantity)}
          onToken={(symbol) => choose('to', symbol)}
        />
      </div>

      <dl className="wswap-facts">
        <div>
          <dt>Rate</dt>
          <dd>{rateLabel}</dd>
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
        <div>
          <dt>Minimum at this price</dt>
          <dd>{minimum == null ? 'Unavailable' : `${minimum.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to.symbol}`}</dd>
        </div>
      </dl>
      {rate != null && <p className="wswap-note">This rate comes from token prices, with slippage applied to the minimum. It is not an executable quote, and this wallet does not charge a swap fee here.</p>}
      {rate == null && <p className="wswap-note">No price is available for this pair, so nothing is estimated.</p>}

      {reviewing ? (
        <div className="wswap-review">
          <h2>Review swap</h2>
          <dl className="wact-facts">
            <div><dt>From</dt><dd>{fromQuantity ?? '—'} {from.symbol}</dd></div>
            <div><dt>To</dt><dd>{toQuantity == null ? 'Unavailable' : `${toQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to.symbol}`}</dd></div>
            <div><dt>Rate</dt><dd>{rateLabel}</dd></div>
            <div><dt>Slippage</dt><dd>{slippage}%</dd></div>
            <div><dt>Minimum at this price</dt><dd>{minimum == null ? 'Unavailable' : `${minimum.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to.symbol}`}</dd></div>
          </dl>
          <p className="wswap-note">This wallet has no swap route for {from.symbol} to {to.symbol}. Nothing was sent.</p>
          <div className="wswap-review-actions">
            <Button type="button" variant="outline" onClick={() => setReviewing(false)}>Back</Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          className="wswap-preview w-full border-transparent bg-[#1A1028] text-white hover:bg-[#120a1c]"
          disabled={!canPreview}
          onClick={() => setReviewing(true)}
        >
          {insufficient ? 'Amount exceeds balance' : 'Preview swap'}
        </Button>
      )}
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
            <strong>{amount || '0.00'}</strong>
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
