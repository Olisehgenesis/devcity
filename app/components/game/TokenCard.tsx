'use client';

/** Round coin with thick rim, empty center emblem, subtle shine. 6 color variants. */
export const TOKEN_TONES = ['lime', 'coral', 'sky', 'blush', 'sun', 'mint'] as const;
export type TokenTone = (typeof TOKEN_TONES)[number];

const TONE_HEX: Record<TokenTone, string> = {
  lime: '#d6ff55',
  coral: '#ff795f',
  sky: '#83d8ee',
  blush: '#f5a6c6',
  sun: '#ffb35c',
  mint: '#8bffcc',
};

export function TokenCoin({
  tone = 'lime',
  size = 44,
  symbol,
  empty = false,
}: {
  tone?: TokenTone;
  size?: number;
  symbol?: string;
  empty?: boolean;
}) {
  const hex = TONE_HEX[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="token-coin">
      {/* rim */}
      <circle cx="24" cy="24" r="22" fill="#fffef9" stroke="#1c2925" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="17.5" fill={hex} stroke="#1c2925" strokeWidth="2" />
      {/* subtle shine */}
      <path d="M13 12c4-3 9-3 12-1" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      {/* center emblem */}
      {empty ? (
        <circle cx="24" cy="24" r="6.5" fill="none" stroke="#1c2925" strokeWidth="2" opacity=".5" />
      ) : (
        <text
          x="24"
          y="28"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="800"
          fill="#1c2925"
          fontFamily="var(--font-body)"
        >
          {symbol ? symbol.slice(0, 4).toUpperCase() : 'DEV'}
        </text>
      )}
    </svg>
  );
}

/** TokenCard: coin + label + balance row used across the game UI. */
export function TokenCard({
  tone = 'lime',
  symbol,
  name,
  balance,
  sub,
}: {
  tone?: TokenTone;
  symbol: string;
  name?: string;
  balance: string;
  sub?: string;
}) {
  return (
    <div className={`token-card tone-${tone}`}>
      <TokenCoin tone={tone} symbol={symbol} />
      <div className="token-card-copy">
        <strong>{symbol}</strong>
        {name && <span>{name}</span>}
        {sub && <small>{sub}</small>}
      </div>
      <strong className="token-card-balance">{balance}</strong>
    </div>
  );
}
