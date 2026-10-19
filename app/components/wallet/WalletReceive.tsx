'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { encode } from 'uqr';
import { Button } from "@/components/ui/button";

interface WalletReceiveProps {
  address: string;
  chainLabel: string;
  symbol?: string;
  notify?: (message: string) => void;
}

export function WalletReceive({ address, chainLabel, symbol, notify }: WalletReceiveProps) {
  const [copied, setCopied] = useState(false);
  const qr = encode(address, { ecc: 'M', border: 2 });
  const cell = 4;
  const size = qr.data.length * cell;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      notify?.('Wallet address copied.');
    } catch (error: unknown) {
      notify?.(error instanceof Error ? error.message : 'Could not copy the address.');
    }
  }

  return (
    <section className="wallet-receive" aria-labelledby="wallet-receive-title">
      <h3 id="wallet-receive-title">Receive{symbol ? ` ${symbol}` : ''}</h3>
      <p className="you-note">
        Send {symbol ? symbol : 'tokens'} on {chainLabel} to this address. A transfer from another network will not arrive here.
      </p>
      <div className="wallet-qr" aria-hidden="true">
        <svg width="196" height="196" viewBox={`0 0 ${size} ${size}`}>
          <rect width={size} height={size} fill="#FFF6FA" />
          {qr.data.map((row, y) => row.map((on, x) => on ? (
            <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#1A1028" />
          ) : null))}
        </svg>
      </div>
      <p className="wallet-receive-address">{address}</p>
      <Button type="button" className="w-full" onClick={() => void copyAddress()}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy address'}
      </Button>
    </section>
  );
}
