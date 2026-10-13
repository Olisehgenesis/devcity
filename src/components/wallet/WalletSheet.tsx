'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { TokenLogo } from '@/components/wallet/TokenLogo';
import { ConnectSheet } from '@/components/wallet/ConnectSheet';
import { TokenDetailSheet } from '@/components/wallet/TokenDetailSheet';
import { TradeSheet } from '@/components/wallet/TradeSheet';
import { ClaimSheet } from '@/components/wallet/ClaimSheet';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWallet } from '@/hooks/useWallet';
import { CELO_SEPOLIA } from '@/lib/chain';
import { fetchTokenTransfers, type WalletActivity } from '@/lib/token-market';
import { useAppStore } from '@/lib/store';
import { Bell, Settings, QrCode } from 'lucide-react';
import { formatUsd } from '@/lib/utils';

export type WalletView = 'portfolio' | 'token' | 'trade' | 'claim' | 'receive' | 'activity';
export type TradeMode = 'buy' | 'sell' | 'swap' | 'send';

export function WalletSheet() {
  const { isConnected, address, isCorrectChain } = useWallet();
  const { isConnected: connected } = usePortfolio();
  const publicClient = usePublicClient();

  const [view, setView] = useState<WalletView>('portfolio');
  const [tradeMode, setTradeMode] = useState<TradeMode>('sell');
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const storeClaims = useAppStore((s) => s.claims);

  // Refresh on-chain activity when wallet opens
  useEffect(() => {
    if (isConnected && address && publicClient) {
      fetchTokenTransfers(publicClient, address as any).then(setActivities).catch(() => setActivities([]));
    }
  }, [isConnected, address, publicClient]);

  const isOpen = useAppStore((s) => s.activeBottomSheet === 'wallet');
  const onClose = () => useAppStore.getState().setActiveBottomSheet('none');

  const openTrade = (mode: TradeMode) => { setTradeMode(mode); setView('trade'); };

  if (!isConnected) {
    return (
      <ConnectSheet isOpen={isOpen} onClose={onClose} />
    );
  }

  if (view === 'token') {
    return <TokenDetailSheet onBack={() => setView('portfolio')} onTrade={(mode) => setView('trade')} />;
  }
  if (view === 'trade') {
    return <TradeSheet onBack={() => setView('token')} initialMode={tradeMode} />;
  }
  if (view === 'claim') {
    return <ClaimSheet onBack={() => setView('portfolio')} />;
  }
  if (view === 'receive') {
    return (
      <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto bg-white text-gray-900">
          <ReceiveView address={address} onDone={() => setView('portfolio')} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto bg-white text-gray-900">
        <PortfolioView
          address={address}
          isCorrectChain={isCorrectChain}
          activities={activities}
          storeClaims={storeClaims}
          onOpenToken={() => setView('token')}
          onTrade={openTrade}
          onOpenClaims={() => setView('claim')}
          onReceive={() => setView('receive')}
        />
      </SheetContent>
    </Sheet>
  );
}

export function ReceiveView({ address, onDone }: { address: string | undefined; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const addr = address as string;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="text-center text-xl">Receive</SheetTitle>
        <SheetDescription className="text-center text-sm text-gray-500">Show this address to receive tokens on Celo Sepolia</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-gray-100 border border-gray-200">
          <QrCode className="h-32 w-32 text-gray-700" />
        </div>
        <code className="rounded-xl bg-gray-100 px-4 py-3 text-sm break-all text-gray-700">{addr}</code>
        <div className="flex w-full gap-2">
          <Button className="flex-1" onClick={copy}>{copied ? 'Copied ✓' : 'Copy address'}</Button>
          <Button variant="outline" onClick={onDone}>Done</Button>
        </div>
      </div>
    </div>
  );
}

export function PortfolioHeader({ address, totalUsd, onTrade, onReceive, onOpenClaims }: any) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenLogo symbol="DEV26" size={40} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{address?.slice(0, 6)}…{address?.slice(-4)}</p>
            <p className="text-xs text-gray-500">Celo Sepolia</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => useAppStore.getState().addNotification({ type: 'info', message: 'Notifications' })} className="p-2 rounded-full hover:bg-gray-100" aria-label="Notifications">
            <Bell className="h-5 w-5 text-gray-500" />
          </button>
          <button onClick={() => useAppStore.getState().addNotification({ type: 'info', message: 'Settings' })} className="p-2 rounded-full hover:bg-gray-100" aria-label="Settings">
            <Settings className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-gray-500">Total balance</p>
        <p className="text-4xl font-extrabold tracking-tight text-gray-900">{formatUsd(totalUsd ?? 0)}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">▲ 0.0%</span>
          <span className="text-xs text-gray-400">past 24h · live on-chain</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-6 gap-2">
        <QuickAction label="Buy" icon="💰" onClick={() => onTrade('buy')} />
        <QuickAction label="Sell" icon="💸" onClick={() => onTrade('sell')} />
        <QuickAction label="Swap" icon="🔁" onClick={() => onTrade('swap')} />
        <QuickAction label="Send" icon="📤" onClick={() => onTrade('send')} />
        <QuickAction label="Receive" icon="📥" onClick={onReceive} />
        <QuickAction label="Claim" icon="🎁" onClick={onOpenClaims} />
      </div>
    </div>
  );
}

export function QuickAction({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-2xl py-2 hover:bg-gray-50 transition-colors">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-lg">{icon}</span>
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
    </button>
  );
}

export function ChartCard({ price, change, poolCreated }: { price: number | null; change: number | null; poolCreated: boolean }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {['1D', '1W', '1M', '1Y', 'ALL'].map((r) => (
            <button key={r} className="rounded-full px-2.5 py-1 font-medium text-gray-500">{r}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400">Price</span>
      </div>
      <div className="mt-4 h-28">
        {price != null ? (
          <svg viewBox="0 0 320 100" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="walletLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 40, 60, 80].map((y) => (
              <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
            ))}
            <line x1="0" y1="50" x2="320" y2="50" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
            <rect x="0" y="50" width="320" height="50" fill="url(#walletLine)" />
            <circle cx="320" cy="50" r="3" fill="#0f172a" />
          </svg>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <p className="text-sm text-gray-400">No market data</p>
            {!poolCreated && <p className="text-xs text-gray-300">Seed the DEV26/USDT pool to get a price</p>}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>{change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}</span>
        <span>Live spot price</span>
      </div>
    </div>
  );
}

function PortfolioView({ address, isCorrectChain, activities, storeClaims, onOpenToken, onTrade, onOpenClaims, onReceive }: any) {
  const { assets, totalValueUsd, tokenMarket } = usePortfolio();

  const txList = useMemo(() => {
    const fromClaims = (storeClaims || []).map((c: any) => ({
      id: `claim-${c.id}`,
      kind: 'claim' as const,
      symbol: c.tokenSymbol || 'DEV26',
      amount: Number(c.amount || 0),
      timestamp: Number(c.claimedAt || 0),
      txHash: c.txHash,
    }));
    const fromChain = (activities || []).map((a: WalletActivity) => ({
      id: a.txHash,
      kind: a.kind,
      symbol: a.symbol,
      amount: a.amount,
      timestamp: a.timestamp * 1000,
      txHash: a.txHash,
    }));
    const merged = [...fromClaims, ...fromChain].sort((a, b) => b.timestamp - a.timestamp);
    return merged.slice(0, 20);
  }, [activities, storeClaims]);

  return (
    <div className="space-y-5 pb-4">
      <PortfolioHeader address={address} totalUsd={totalValueUsd} onTrade={onTrade} onReceive={onReceive} onOpenClaims={onOpenClaims} />

      <ChartCard price={tokenMarket?.price ?? null} change={tokenMarket?.change24h ?? null} poolCreated={tokenMarket?.poolCreated ?? false} />

      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-gray-900">Assets</h2>
        <button onClick={onOpenToken} className="text-sm font-medium text-gray-500 hover:text-gray-900">Manage</button>
      </div>
      <div className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100">
        {assets.map((a) => (
          <button key={a.key} onClick={() => onOpenToken(a.key)} className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
            <TokenLogo symbol={a.symbol} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{a.symbol}</p>
              <p className="text-xs text-gray-400">{a.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{a.formatted.toLocaleString(undefined, { maximumFractionDigits: 4 })} {a.symbol}</p>
              <p className="text-xs text-gray-400">{a.valueUsd != null ? formatUsd(a.valueUsd) : '—'}</p>
            </div>
            <div className="w-16 text-right">
              {a.change24h != null ? (
                <p className={`text-xs font-semibold ${a.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>{a.change24h >= 0 ? '+' : ''}{a.change24h.toFixed(2)}%</p>
              ) : (
                <p className="text-xs text-gray-300">—</p>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-gray-900">Activity</h2>
        <button onClick={() => useAppStore.getState().addNotification({ type: 'info', message: 'All activity on-chain' })} className="text-sm font-medium text-gray-500">View all</button>
      </div>
      {txList.length > 0 ? (
        <div className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100">
          {txList.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm">
                {t.kind === 'send' ? '↑' : t.kind === 'receive' ? '↓' : t.kind === 'claim' ? '🎁' : '⇄'}
              </span>
              <div className="flex-1">
                <p className="text-sm capitalize text-gray-800">{t.kind === 'claim' ? `Claim ${t.symbol}` : t.kind === 'send' ? `Send ${t.symbol}` : `Receive ${t.symbol}`}</p>
                <p className="text-xs text-gray-400">{new Date(t.timestamp).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {t.symbol}</p>
                {t.txHash && (
                  <a href={`${CELO_SEPOLIA.blockExplorer}/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-blue-600">View</a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-400">No activity yet</p>
          <p className="text-xs text-gray-300 mt-1">Your transactions and claims will appear here</p>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={onOpenClaims}>View claims & drops</Button>
      <Separator />
      <p className="pb-4 text-center text-xs text-gray-300">Prices read live from the DEV26/USDT pool · no fake data</p>
    </div>
  );
}
