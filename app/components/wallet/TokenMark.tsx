const TOKEN_ICONS: Record<string, string> = {
  CELO: '/assets/tokens/celo.svg',
  USDT: '/assets/tokens/usdt.png',
  USDC: '/assets/tokens/usdc.svg',
  USDm: '/assets/tokens/usdm.svg',
};

export function tokenIconSrc(symbol: string) {
  return TOKEN_ICONS[symbol] ?? null;
}

export function TokenMark({ symbol, src }: { symbol: string; src?: string | null }) {
  const icon = src || tokenIconSrc(symbol);
  if (!icon) return <span className="wh-mark" aria-hidden="true">{symbol.slice(0, 1)}</span>;
  return <img className="wh-mark" src={icon} alt="" />;
}
