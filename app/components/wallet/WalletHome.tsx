'use client';

import type { ReactNode } from 'react';
import { STICKER_DEFS, useGameStore } from '../../lib/game-store';
import { TokenCoin, type TokenTone } from '../game/TokenCard';
import type { ProfileTokenSummary } from '../../hooks/useProfileToken';
import type { HeldTokenView } from './types';

interface WalletHomeProps {
  chainLabel: string;
  celoBalance: string;
  stableBalances: Record<string, number>;
  profileToken?: ProfileTokenSummary | null;
  onOpenToken: (token: HeldTokenView) => void;
  onOpenProfile: () => void;
  children: ReactNode;
}

const COIN_TONES = new Set<TokenTone>(['lime', 'coral', 'sky', 'blush', 'sun', 'mint']);

function coinTone(tone: string): TokenTone {
  return COIN_TONES.has(tone as TokenTone) ? tone as TokenTone : 'lime';
}

const STABLES = [
  { symbol: 'USDT', name: 'Tether USD', digits: 2 },
  { symbol: 'USDC', name: 'USD Coin', digits: 2 },
  { symbol: 'cUSD', name: 'Celo Dollar', digits: 4 },
] as const;

export function WalletHome({ chainLabel, celoBalance, stableBalances, profileToken, onOpenToken, onOpenProfile, children }: WalletHomeProps) {
  const stickers = useGameStore((state) => state.stickers);
  const heldStables = STABLES.filter((token) => (stableBalances[token.symbol] ?? 0) > 0);
  const profileBalance = profileToken ? Number(profileToken.balance) / 10 ** profileToken.decimals : 0;

  return (
    <>
      <section className="wallet-token-section" aria-labelledby="wallet-tokens-title">
        <div className="wallet-section-heading">
          <h3 id="wallet-tokens-title">Tokens</h3>
          <span>On {chainLabel}</span>
        </div>
        <div className="wallet-token-list">
          <button
            type="button"
            className="wallet-token-row"
            onClick={() => onOpenToken({
              kind: 'celo',
              symbol: 'CELO',
              name: 'Celo native',
              balance: `${celoBalance} CELO`,
              sendToken: 'CELO',
            })}
          >
            <span className="wallet-token-mark">C</span>
            <span className="wallet-token-name"><strong>CELO</strong><small>Celo native</small></span>
            <strong className="wallet-token-balance">{celoBalance}</strong>
          </button>
          {heldStables.map((token) => (
            <button
              type="button"
              key={token.symbol}
              className="wallet-token-row"
              onClick={() => onOpenToken({
                kind: 'stable',
                symbol: token.symbol,
                name: token.name,
                balance: stableBalances[token.symbol].toFixed(token.digits),
                sendToken: token.symbol,
              })}
            >
              <span className={`wallet-token-mark wallet-token-${token.symbol.toLowerCase()}`}>{token.symbol.slice(0, 1)}</span>
              <span className="wallet-token-name"><strong>{token.symbol}</strong><small>{token.name}</small></span>
              <strong className="wallet-token-balance">{stableBalances[token.symbol].toFixed(token.digits)}</strong>
            </button>
          ))}
          <button type="button" className="wallet-token-row" onClick={onOpenProfile}>
            <span className="wallet-token-mark wallet-token-profile">{profileToken ? profileToken.symbol.slice(0, 1) : '✦'}</span>
            <span className="wallet-token-name">
              <strong>{profileToken ? profileToken.symbol : 'Profile token'}</strong>
              <small>{profileToken ? profileToken.name : 'Launch a token for your handle'}</small>
            </span>
            <strong className="wallet-token-balance">
              {profileToken ? profileBalance.toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'Launch'}
            </strong>
          </button>
        </div>
        {children}
      </section>

      <details className="wallet-sticker-disclosure">
        <summary>Sticker album <span>City collectibles</span></summary>
        <div className="sticker-album">
          {STICKER_DEFS.map((sticker) => {
            const collected = stickers[sticker.id] ?? 0;
            return (
              <div className="sticker-slot" key={sticker.id}>
                <TokenCoin tone={coinTone(sticker.tone)} empty={collected === 0} size={40} />
                <small>{collected > 0 ? `${collected}` : sticker.label}</small>
              </div>
            );
          })}
        </div>
      </details>
    </>
  );
}
