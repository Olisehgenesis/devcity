'use client';

import { useMemo, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Separator } from '@/components/ui/Separator';
import { TokenLogo } from '@/components/wallet/TokenLogo';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAppStore } from '@/lib/store';
import { CELO_SEPOLIA, DEVCITY26_TOKEN_ABI, ERC20_ABI } from '@/lib/chain';
import { buildBuyCallData } from '@/lib/trade';
import { UNIVERSAL_ROUTER_ABI } from '@/lib/trade';
import type { TradeMode } from '@/components/wallet/WalletSheet';
import { toHex } from 'viem';
import { ArrowLeft, Check, XCircle } from 'lucide-react';
import { formatUsd } from '@/lib/utils';

type Step = 'form' | 'review' | 'approving' | 'confirming' | 'done' | 'error';

const SLIPPAGE = 0.01; // 1%

export function TradeSheet({ onBack, initialMode = 'sell' }: { onBack: () => void; initialMode?: TradeMode }) {
  const { tokenMarket, assets } = usePortfolio();
  const { address } = useAccount();
  const isOpen = useAppStore((s) => s.activeBottomSheet === 'wallet');
  const onClose = () => useAppStore.getState().setActiveBottomSheet('none');

  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);

  const devcity = assets.find((a) => a.key === 'devcity');
  const usdt = assets.find((a) => a.key === 'usdt');
  const price = tokenMarket?.price ?? null;
  const poolCreated = tokenMarket?.poolCreated ?? false;

  const amountNum = Number(amount || 0);
  const isSend = mode === 'send';

  // Real quote from pool price
  const quote = useMemo(() => {
    if (price == null || amountNum <= 0) return null;
    if (mode === 'sell') {
      const out = amountNum * price;
      return { out, minOut: out * (1 - SLIPPAGE), impact: 0 };
    }
    if (mode === 'buy' || mode === 'swap') {
      const out = amountNum / price;
      return { out, minOut: out * (1 - SLIPPAGE), impact: 0 };
    }
    return null;
  }, [price, amountNum, mode]);

  const { writeContractAsync, data: writeData, isPending: writePending, error: writeError } = useWriteContract();
  const { isPending: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: writeData as any, query: { enabled: !!writeData } });

  const balanceForMode = useMemo(() => {
    if (mode === 'sell' || mode === 'swap') return devcity?.formatted ?? 0;
    if (mode === 'buy') return usdt?.formatted ?? 0;
    if (mode === 'send') return devcity?.formatted ?? 0;
    return 0;
  }, [mode, devcity, usdt]);

  const setModeSafe = (m: TradeMode) => {
    setMode(m);
    setStep('form');
    setError(null);
    setAmount('');
  };

  const handleReview = () => {
    if (amountNum <= 0) { setError('Enter an amount'); return; }
    if (amountNum > balanceForMode) { setError('Insufficient balance'); return; }
    if (isSend && recipient.length < 6) { setError('Enter a valid recipient address'); return; }
    if ((mode === 'sell' || mode === 'swap' || mode === 'buy') && !poolCreated) {
      setError('Pool not seeded yet — cannot quote a price');
      return;
    }
    setError(null);
    setStep('review');
  };

  const execute = async () => {
    setError(null);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5);
    const amountBig = BigInt(Math.round(amountNum * 10 ** 18));
    try {
      if (mode === 'sell') {
        const minOut = quote ? BigInt(Math.round(quote.minOut * 10 ** 18)) : BigInt(0);
        await writeContractAsync({
          address: CELO_SEPOLIA.devcityToken as any,
          abi: DEVCITY26_TOKEN_ABI as any,
          functionName: 'burnForUSDT',
          args: [amountBig, minOut, deadline],
        });
      } else if (mode === 'send') {
        const to = recipient as any;
        await writeContractAsync({
          address: CELO_SEPOLIA.devcityToken as any,
          abi: ERC20_ABI as any,
          functionName: 'transfer',
          args: [to, amountBig],
        });
      } else if (mode === 'buy') {
        // USDT amount in (6 decimals), min DEV26 out (18 decimals)
        const usdtIn = BigInt(Math.round(amountNum * 10 ** 6));
        const minOut = quote ? BigInt(Math.round(quote.minOut * 10 ** 18)) : BigInt(0);
        const calldata = buildBuyCallData(usdtIn, minOut, deadline);
        await writeContractAsync({
          address: CELO_SEPOLIA.universalRouter as any,
          abi: UNIVERSAL_ROUTER_ABI as any,
          functionName: 'execute',
          args: [toHex(new Uint8Array([0x10])), [calldata], deadline],
        });
      } else if (mode === 'swap') {
        // DEV26 -> USDT via sell path
        const minOut = quote ? BigInt(Math.round(quote.minOut * 10 ** 6)) : BigInt(0);
        await writeContractAsync({
          address: CELO_SEPOLIA.devcityToken as any,
          abi: DEVCITY26_TOKEN_ABI as any,
          functionName: 'burnForUSDT',
          args: [amountBig, minOut, deadline],
        });
      }
      setStep('confirming');
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed';
      setError(msg);
      setStep('error');
      useAppStore.getState().addNotification({ type: 'error', message: msg });
      return;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto bg-white text-gray-900">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-500">Trade</span>
            <span className="w-8" />
          </div>
        </SheetHeader>

        {step === 'form' && (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-2">
              {(['buy', 'sell', 'swap', 'send'] as TradeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModeSafe(m)}
                  className={`rounded-xl py-2 text-sm font-semibold capitalize transition-colors ${mode === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{isSend ? 'To' : 'You pay'}</span>
                <span>Balance: {balanceForMode.toLocaleString(undefined, { maximumFractionDigits: 4 })} {mode === 'buy' ? 'USDT' : 'DEV26'}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <TokenLogo symbol={isSend ? 'DEV26' : mode === 'buy' ? 'USDT' : 'DEV26'} size={32} />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 border-0 bg-transparent text-2xl font-bold text-gray-900 shadow-none focus-visible:ring-0"
                />
                <button className="text-xs font-semibold text-gray-500 hover:text-gray-900">MAX</button>
              </div>
            </div>

            {isSend ? (
              <div>
                <div className="text-xs text-gray-400">Recipient address</div>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="mt-1 rounded-2xl border-gray-200 bg-gray-50"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>You receive</span>
                </div>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <TokenLogo symbol={mode === 'buy' ? 'DEV26' : 'USDT'} size={32} />
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-gray-900">{quote ? quote.out.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0.00'}</p>
                    <p className="text-xs text-gray-400">{mode === 'buy' ? 'DEV26' : 'USDT'} ~ {quote ? formatUsd(quote.out) : '—'}</p>
                  </div>
                </div>
                {price != null && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>Rate</span>
                    <span>1 DEV26 = {formatUsd(price)}</span>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            {!poolCreated && (mode === 'sell' || mode === 'buy' || mode === 'swap') && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">The DEV26/USDT pool hasn&apos;t been seeded yet, so no on-chain price is available.</p>
            )}

            <Button className="w-full h-12" disabled={writePending} onClick={handleReview}>Review {mode}</Button>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-5">
            <SheetTitle className="text-center text-lg">Review {mode}</SheetTitle>
            <div className="space-y-3 rounded-2xl bg-gray-50 border border-gray-100 p-4 text-sm">
              <Row label={isSend ? 'Send' : 'You pay'} value={`${amountNum} ${isSend ? 'DEV26' : mode === 'buy' ? 'USDT' : 'DEV26'}`} />
              {!isSend && <Row label="You receive" value={`${quote?.out.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? '0'} ${mode === 'buy' ? 'DEV26' : 'USDT'}`} />}
              {!isSend && price != null && <Row label="Price" value={`1 DEV26 = ${formatUsd(price)}`} />}
              {!isSend && <Row label="Slippage" value={`${(SLIPPAGE * 100).toFixed(0)}%`} />}
              {isSend && <Row label="To" value={recipient.slice(0, 10) + '…' + recipient.slice(-6)} />}
              <Row label="Network" value="Celo Sepolia" />
            </div>
            <Separator />
            <p className="text-xs text-gray-400">You will be asked to sign this transaction in your wallet. Review the estimated output carefully.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('form')}>Back</Button>
              <Button className="flex-1" isLoading={writePending || confirming} onClick={execute}>Confirm & sign</Button>
            </div>
          </div>
        )}

        {(step === 'confirming' || step === 'done' || step === 'error') && (
          <div className="space-y-5 py-6 text-center">
            {step === 'error' ? (
              <>
                <XCircle className="mx-auto h-12 w-12 text-red-500" />
                <SheetTitle className="text-lg">Transaction failed</SheetTitle>
                <p className="text-sm text-gray-500">{error || 'The transaction was rejected or reverted.'}</p>
                <Button className="w-full" onClick={() => setStep('form')}>Try again</Button>
              </>
            ) : confirmed ? (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <SheetTitle className="text-lg">Confirmed</SheetTitle>
                <p className="text-sm text-gray-500">Your transaction was confirmed on-chain.</p>
                <Button variant="outline" className="w-full" onClick={() => { setStep('form'); setAmount(''); useAppStore.getState().setActiveBottomSheet('wallet'); }}>Done</Button>
              </>
            ) : writeData ? (
              <>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                <SheetTitle className="text-lg">Transaction submitted</SheetTitle>
                <p className="text-sm text-gray-500">Waiting for confirmation…</p>
              </>
            ) : (
              <>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                <SheetTitle className="text-lg">Confirming</SheetTitle>
                <p className="text-sm text-gray-500">Sign the transaction in your wallet.</p>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
