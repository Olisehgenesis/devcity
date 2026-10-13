'use client';

import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TokenLogo } from '@/components/wallet/TokenLogo';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAppStore } from '@/lib/store';
import { CELO_SEPOLIA } from '@/lib/chain';
import type { TradeMode } from '@/components/wallet/WalletSheet';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { formatUsd } from '@/lib/utils';

export function TokenDetailSheet({ onBack, onTrade }: { onBack: () => void; onTrade: (mode: TradeMode) => void }) {
  const { tokenMarket, assets } = usePortfolio();
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  const isOpen = useAppStore((s) => s.activeBottomSheet === 'wallet');
  const onClose = () => useAppStore.getState().setActiveBottomSheet('none');

  const devcity = assets.find((a) => a.key === 'devcity');
  const holdingValue = devcity?.valueUsd ?? null;

  const stats = useMemo(() => {
    return [
      { label: 'Market cap', value: tokenMarket?.marketCap != null ? formatUsd(tokenMarket.marketCap) : '—' },
      { label: 'Price', value: tokenMarket?.price != null ? formatUsd(tokenMarket.price) : '—' },
      { label: '24h volume', value: tokenMarket?.volume24h != null ? formatUsd(tokenMarket.volume24h) : '—' },
      { label: 'Circulating supply', value: tokenMarket?.circulatingSupply?.toLocaleString() ?? '—' },
      { label: 'Total supply', value: tokenMarket?.totalSupply?.toLocaleString() ?? '—' },
      { label: 'FDV', value: tokenMarket?.fdValue != null ? formatUsd(tokenMarket.fdValue) : '—' },
    ];
  }, [tokenMarket]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CELO_SEPOLIA.devcityToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto bg-white text-gray-900">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-500">Token details</span>
            <span className="w-8" />
          </div>
        </SheetHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <TokenLogo symbol="DEV26" size={52} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">DEVCITY26</h2>
              <p className="text-sm text-gray-400">{tokenMarket?.symbol ?? 'DEV26'}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xl font-extrabold text-gray-900">{tokenMarket?.price != null ? formatUsd(tokenMarket.price) : '—'}</p>
              <p className="text-xs text-gray-400">USD</p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-gray-500">{CELO_SEPOLIA.devcityToken}</code>
              <button onClick={copy} className="text-gray-400 hover:text-gray-700" aria-label="Copy address">
                <Copy className="h-4 w-4" />
              </button>
              <a href={`${CELO_SEPOLIA.blockExplorer}/address/${CELO_SEPOLIA.devcityToken}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-700" aria-label="Explorer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {copied && <p className="text-xs text-green-600 mt-1">Copied ✓</p>}
          </div>

          {/* Chart */}
          <div className="rounded-3xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {['1D', '1W', '1M', '1Y', 'ALL'].map((r) => (
                <button key={r} className="rounded-full px-2.5 py-1 font-medium text-gray-500">{r}</button>
              ))}
            </div>
            <div className="mt-3 h-28">
              {tokenMarket?.price != null ? (
                <svg viewBox="0 0 320 100" className="h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="detailLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[20, 40, 60, 80].map((y) => (
                    <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
                  ))}
                  <line x1="0" y1="50" x2="320" y2="50" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                  <rect x="0" y="50" width="320" height="50" fill="url(#detailLine)" />
                  <circle cx="320" cy="50" r="3" fill="#0f172a" />
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-400">{tokenMarket?.poolCreated ? 'Historical data unavailable' : 'Pool not seeded — no price yet'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Your holdings */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs text-gray-400">Your holdings</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-lg font-bold text-gray-900">
                {devcity?.formatted.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? 0} DEV26
              </p>
              <p className="text-sm text-gray-500">{holdingValue != null ? formatUsd(holdingValue) : '—'}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1">Wallet {address?.slice(0, 6)}…{address?.slice(-4)}</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button className="h-12" onClick={() => onTrade('buy')}>Buy</Button>
            <Button variant="outline" className="h-12" onClick={() => onTrade('sell')}>Sell</Button>
            <Button variant="outline" className="h-12" onClick={() => onTrade('swap')}>Swap</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
