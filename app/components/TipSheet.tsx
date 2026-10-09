'use client';

import { useState } from 'react';
import { Sheet } from './Sheet';
import { useCityStore } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';

export interface TipTarget {
  name: string;
  initials: string;
  color: string;
}

interface TipSheetProps {
  open: boolean;
  onClose: () => void;
  target: TipTarget | null;
  isConnected: boolean;
  onNeedWallet: () => void;
  notify: (msg: string) => void;
}

const PRESETS = ['1', '5', '10'];
const TOKENS = ['OLISEH', 'DEV26', 'ETHHOUSE'];

export function TipSheet({ open, onClose, target, isConnected, onNeedWallet, notify }: TipSheetProps) {
  const sendTip = useCityStore((s) => s.sendTip);
  const [amount, setAmount] = useState('5');
  const [token, setToken] = useState(TOKENS[0]);
  const [custom, setCustom] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const finalAmount = custom || amount;

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

  const send = () => {
    if (!isConnected) {
      close();
      onNeedWallet();
      notify('Connect a wallet to tip.');
      return;
    }
    if (!finalAmount || Number(finalAmount) <= 0 || !target) return;
    setSending(true);
    setTimeout(() => {
      sendTip(target.name, token, finalAmount);
      setSending(false);
      setDone(true);
      notify(`Sent ${finalAmount} ${token} to ${target.name}.`);
      setTimeout(close, 1400);
    }, 800);
  };

  if (!target) return null;

  return (
    <Sheet open={open} onClose={close} eyebrow="Send a tip" title={`Tip ${target.name}`}>
      <div className="tip-body">
        <div className="tip-target">
          <div className={`marker-avatar tone-${target.color}`}><img src={dicebearAvatarUrl(target.name, avatarBackgroundForColor(target.color))} alt="" /></div>
          <span>{target.name} · instant, no fees you pay</span>
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

            <div className="tip-tokens">
              {TOKENS.map((t) => (
                <button
                  key={t}
                  className={`tip-token${token === t ? ' is-selected' : ''}`}
                  onClick={() => setToken(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <button className="tip-send" disabled={sending || !finalAmount} onClick={send}>
              {sending ? (
                <><span className="spinner" /> Sending…</>
              ) : (
                `Tip ${finalAmount} ${token}`
              )}
            </button>
            {!isConnected && <p className="tip-note">You will be asked to connect first.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
