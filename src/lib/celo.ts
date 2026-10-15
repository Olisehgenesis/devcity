import { celo, celoSepolia } from 'viem/chains';
import type { Address, Hex } from 'viem';

export const CELO_MAINNET_ID = celo.id; // 42220
export const CELO_SEPOLIA_ID = celoSepolia.id; // 44787

export const IS_MAINNET = process.env.NEXT_PUBLIC_CELO_NETWORK === 'mainnet';

/** The chain the app transacts on for the current build. */
export const ACTIVE_CHAIN = IS_MAINNET ? celo : celoSepolia;

/** All chains the app can operate on (mainnet for prod, sepolia for testing). */
export const CELO_CHAINS = [celo, celoSepolia] as const;

export interface FeeCurrency {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}

/**
 * Celo fee currencies (stablecoins you can pay gas with on Celo).
 * Order = preference for auto-selection (default USDT, then USDC, cUSD, and more).
 */
export const FEE_CURRENCIES: Record<number, FeeCurrency[]> = {
  [CELO_MAINNET_ID]: [
    { symbol: 'USDT', name: 'Tether USD', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6 },
    { symbol: 'cUSD', name: 'Celo Dollar', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
    { symbol: 'cEUR', name: 'Celo Euro', address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA07', decimals: 18 },
    { symbol: 'cREAL', name: 'Celo Brazilian Real', address: '0xe8537a3d056DA446677B9E5d6AE5beA3bCEfC335', decimals: 18 },
  ],
  [CELO_SEPOLIA_ID]: [
    { symbol: 'USDT', name: 'Tether USD', address: '0xd077A400968890Eacc75cdc901F0356c943e4fDb', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E', decimals: 6 },
    { symbol: 'cUSD', name: 'Celo Dollar', address: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', decimals: 18 },
  ],
};

export function feeCurrenciesFor(chainId: number): FeeCurrency[] {
  return FEE_CURRENCIES[chainId] ?? FEE_CURRENCIES[CELO_MAINNET_ID];
}

/**
 * The `gasCurrency` (a.k.a. fee currency) tx override for a chosen stablecoin.
 * On Celo, passing this makes the user pay gas in that stablecoin instead of CELO.
 * Pass the result as the tx `gasCurrency` (viem) / in the transaction request.
 */
export function gasCurrencyOverride(chainId: number, symbol?: string): { gasCurrency: Address } | null {
  const currencies = feeCurrenciesFor(chainId);
  if (!symbol) return null;
  const match = currencies.find((c) => c.symbol === symbol);
  return match ? { gasCurrency: match.address } : null;
}

export function toGasCurrency(chainId: number, symbol?: string): Hex | undefined {
  const override = gasCurrencyOverride(chainId, symbol);
  return override?.gasCurrency;
}
