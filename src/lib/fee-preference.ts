const STORAGE_KEY = 'devcity.feePreference';

/** `auto` keeps the chain order: CELO when it covers the fee, then USDT, USDC, then other fee currencies. */
export function readFeePreference(): string {
  if (typeof localStorage === 'undefined') return 'auto';
  const saved = localStorage.getItem(STORAGE_KEY)?.trim();
  return saved || 'auto';
}

export function writeFeePreference(value: string): void {
  const next = value.trim() || 'auto';
  localStorage.setItem(STORAGE_KEY, next);
}
