'use client';

import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from '@/components/ui/button';
import { useCityStore } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';

export interface TipTarget {
  name: string;
  initials: string;
  color: string;
  address?: string;
}

interface TipSheetProps {
  open: boolean;
  onClose: () => void;
  target: TipTarget | null;
  onNeedWallet: () => void;
  notify: (msg: string) => void;
}

const PRESETS = ['1', '5', '10'];

export function TipSheet({ open, onClose, target, onNeedWallet, notify }: TipSheetProps) {
  const sendTip = useCityStore((s) => s.sendTip);
  const [amount, setAmount] = useState('5');
  const [tokens, setTokens] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState('');
  const [custom, setCustom] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const finalAmount = custom || amount;
  const recipient = target?.address || resolvedAddress;

  useEffect(() => {
    if (!open) return;
    setResolvedAddress(null);
    if (!target || target.address || !target.name) return;
    let cancelled = false;
    void fetch(`/api/users/${encodeURIComponent(target.name)}`)
      .then(async (response) => (response.ok ? response.json() as Promise<{ address?: string | null }> : null))
      .then((data) => {
        if (!cancelled && data?.address) setResolvedAddress(data.address);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTokensLoading(true);
    setTokensError('');
    void (async () => {
      try {
        const { listLocalWallets } = await import('@/lib/keystore');
        const mine = (await listLocalWallets())[0]?.address;
        const response = await fetch('/api/drops');
        if (!response.ok) throw new Error('Available tip tokens could not be loaded.');
        const data = await response.json() as { drops?: Array<{ tokenSymbol?: string | null; tokenAddress?: string | null; tokenDecimals?: number | null }> };
        const bySymbol = new Map<string, { address: string; decimals: number }>();
        for (const drop of data.drops ?? []) {
          const symbol = drop.tokenSymbol?.trim();
          if (!symbol || !drop.tokenAddress || bySymbol.has(symbol)) continue;
          bySymbol.set(symbol, { address: drop.tokenAddress, decimals: drop.tokenDecimals ?? 18 });
        }
        const held: string[] = [];
        if (mine && bySymbol.size > 0) {
          const { createPublicClient, http, formatUnits } = await import('viem');
          const { celoSepolia } = await import('viem/chains');
          const { CELO_SEPOLIA, ERC20_ABI } = await import('@/lib/chain');
          const client = createPublicClient({ chain: celoSepolia, transport: http(CELO_SEPOLIA.rpcUrl, { timeout: 8_000 }) });
          const balances = await Promise.all([...bySymbol.entries()].map(async ([symbol, tokenInfo]) => {
            try {
              const raw = await client.readContract({
                address: tokenInfo.address as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [mine as `0x${string}`],
              });
              return Number(formatUnits(raw, tokenInfo.decimals)) > 0 ? symbol : null;
            } catch {
              return null;
            }
          }));
          held.push(...balances.filter((symbol): symbol is string => Boolean(symbol)));
        }
        if (!cancelled) {
          setTokens(held);
          setToken((current) => held.includes(current) ? current : held[0] ?? '');
        }
      } catch (error: unknown) {
        if (!cancelled) setTokensError(error instanceof Error ? error.message : 'Available tip tokens could not be loaded.');
      } finally {
        if (!cancelled) setTokensLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const reset = () => {
    setAmount('5');
    setCustom('');
    setDone(false);
    setSending(false);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 250);
  };

  const send = async () => {
    if (!finalAmount || Number(finalAmount) <= 0 || !target) return;
    setSending(true);
    try {
      const self = await import('@/lib/keystore');
      const local = await self.listLocalWallets();
      const myAddress = local[0]?.address;
      if (!myAddress) {
        close();
        onNeedWallet();
        notify('Create a passkey wallet to tip.');
        return;
      }
      if (!recipient) throw new Error('This person cannot receive a tip until a wallet is linked.');
      if (myAddress.toLowerCase() === recipient.toLowerCase()) throw new Error('You cannot tip your own wallet.');
      if (!token) throw new Error('There are no tip tokens available in the city yet.');
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: myAddress,
          toAddress: recipient,
          tokenSymbol: token,
          amount: finalAmount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Tip could not be sent.');
      }
      sendTip(target.name, token, finalAmount);
      setDone(true);
      notify(`Sent ${finalAmount} ${token} to ${target.name}.`);
      setTimeout(close, 1400);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Tip failed. Try again.');
      close();
    } finally {
      setSending(false);
    }
  };

  if (!target) return null;

  return (
    <Sheet open={open} onClose={close} eyebrow="Send a tip" title={`Tip ${target.name}`}>
      <div className="tip-body">
        <div className="tip-target">
          <div className={`marker-avatar tone-${target.color}`}><img src={dicebearAvatarUrl(target.name, avatarBackgroundForColor(target.color))} alt="" /></div>
          <span>{recipient ? `${target.name} · ${recipient.slice(0, 6)}…${recipient.slice(-4)}` : `${target.name} · no wallet linked yet`}</span>
        </div>

        {done ? (
          <div className="tip-done">
            <span className="tip-done-check">✓</span>
            <p>
              {finalAmount} {token} sent to {target.name}
            </p>
          </div>
        ) : (
          <>
            <div className="tip-presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`tip-preset${!custom && amount === p ? ' is-selected' : ''}`}
                  onClick={() => {
                    setAmount(p);
                    setCustom('');
                  }}
                >
                  {p}
                </button>
              ))}
              <input
                className="tip-custom"
                type="number"
                min="0"
                placeholder="Custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))}
                aria-label="Custom amount"
              />
            </div>

            {tokensLoading ? <p className="tip-note">Loading city tokens…</p> : tokensError ? <p className="tip-error" role="alert">{tokensError}</p> : tokens.length > 0 ? (
              <div className="tip-tokens" aria-label="Choose a tip token">
                {tokens.map((availableToken) => (
                  <button
                    key={availableToken}
                    className={`tip-token${token === availableToken ? ' is-selected' : ''}`}
                    onClick={() => setToken(availableToken)}
                  >
                    {availableToken}
                  </button>
                ))}
              </div>
            ) : <p className="tip-note">You don&apos;t hold a token you can tip with yet.</p>}

            <Button type="button" disabled={sending || !finalAmount || !token || !recipient || tokensLoading || Boolean(tokensError)} onClick={send}>
              {sending ? (
                <><span className="spinner" /> Sending…</>
              ) : (
                `Tip ${finalAmount} ${token}`
              )}
            </Button>
            {!recipient && <p className="tip-note">This profile cannot receive a tip until a wallet is linked.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
