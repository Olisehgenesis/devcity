'use client';

import { useMemo } from 'react';
import { useAccount, usePublicClient, useReadContract, useBalance } from 'wagmi';
import { CELO_SEPOLIA, ERC20_ABI, DEVCITY26_TOKEN_ABI, POOL_MANAGER_ABI } from '@/lib/chain';
import { fetchBalances, type TokenMarket } from '@/lib/token-market';
import { getDevcityPoolId } from '@/lib/token-market';

export interface PortfolioAsset {
  key: 'devcity' | 'usdt' | 'celo';
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  formatted: number;
  price: number | null;
  valueUsd: number | null;
  change24h: number | null;
  iconUrl?: string;
}

export function usePortfolio() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const { data: devcityBalance } = useReadContract({
    address: CELO_SEPOLIA.devcityToken as any,
    abi: ERC20_ABI as any,
    functionName: 'balanceOf',
    args: address ? [address as any] : undefined,
    query: { enabled: !!address && !!publicClient },
  });
  const { data: usdtBalance } = useReadContract({
    address: CELO_SEPOLIA.usdt as any,
    abi: ERC20_ABI as any,
    functionName: 'balanceOf',
    args: address ? [address as any] : undefined,
    query: { enabled: !!address && !!publicClient },
  });
  const { data: celoBalance } = useBalance({ address, query: { enabled: !!address } });

  const { data: poolCreated } = useReadContract({
    address: CELO_SEPOLIA.devcityToken as any,
    abi: DEVCITY26_TOKEN_ABI as any,
    functionName: 'poolCreated',
    query: { enabled: !!publicClient },
  });

  const poolId = useReadContract({
    address: CELO_SEPOLIA.devcityToken as any,
    abi: DEVCITY26_TOKEN_ABI as any,
    functionName: 'poolId',
    query: { enabled: !!publicClient && !!poolCreated },
  });

  const { data: slot0 } = useReadContract({
    address: CELO_SEPOLIA.poolManager as any,
    abi: POOL_MANAGER_ABI as any,
    functionName: 'getSlot0',
    args: poolId.data ? [poolId.data as any] : undefined,
    query: { enabled: !!publicClient && !!poolId.data },
  });

  const { data: supply } = useReadContract({
    address: CELO_SEPOLIA.devcityToken as any,
    abi: ERC20_ABI as any,
    functionName: 'totalSupply',
    query: { enabled: !!publicClient },
  });

  // DEV26 price in USDT from pool slot0
  const devcityPrice = useMemo(() => {
    if (!poolCreated || !slot0) return null;
    const sqrt = Number((slot0 as any)[0]) / 2 ** 96;
    const p = sqrt * sqrt; // token1/token0 (both 18 decimals)
    return isFinite(p) && p > 0 ? p : null;
  }, [poolCreated, slot0]);

  const marketCap = useMemo(() => {
    if (devcityPrice == null || supply == null) return null;
    return devcityPrice * (Number(supply) / 10 ** 18);
  }, [devcityPrice, supply]);

  const assets: PortfolioAsset[] = useMemo(() => {
    const list: PortfolioAsset[] = [
      {
        key: 'devcity',
        symbol: 'DEV26',
        name: 'DEVCITY26',
        decimals: 18,
        balance: (devcityBalance as bigint) ?? BigInt(0),
        formatted: Number((devcityBalance as bigint) ?? BigInt(0)) / 10 ** 18,
        price: devcityPrice,
        valueUsd: devcityPrice != null ? (Number((devcityBalance as bigint) ?? BigInt(0)) / 10 ** 18) * devcityPrice : null,
        change24h: null,
      },
      {
        key: 'usdt',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        balance: (usdtBalance as bigint) ?? BigInt(0),
        formatted: Number((usdtBalance as bigint) ?? BigInt(0)) / 10 ** 6,
        price: 1,
        valueUsd: Number((usdtBalance as bigint) ?? BigInt(0)) / 10 ** 6,
        change24h: null,
      },
      {
        key: 'celo',
        symbol: 'CELO',
        name: 'Celo',
        decimals: 18,
        balance: celoBalance?.value ?? BigInt(0),
        formatted: Number(celoBalance?.value ?? BigInt(0)) / 10 ** 18,
        price: null,
        valueUsd: null,
        change24h: null,
      },
    ];
    return list;
  }, [devcityBalance, usdtBalance, celoBalance, devcityPrice]);

  const totalValueUsd = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.valueUsd ?? 0), 0);
  }, [assets]);

  const tokenMarket: TokenMarket | null = useMemo(() => {
    if (!supply) return null;
    return {
      address: CELO_SEPOLIA.devcityToken as any,
      symbol: 'DEV26',
      name: 'DEVCITY26',
      decimals: 18,
      price: devcityPrice,
      marketCap,
      circulatingSupply: Number(supply) / 10 ** 18,
      totalSupply: Number(supply) / 10 ** 18,
      fdValue: marketCap,
      change24h: null,
      volume24h: null,
      poolCreated: !!poolCreated,
    };
  }, [devcityPrice, marketCap, supply, poolCreated]);

  return {
    isConnected,
    address,
    assets,
    totalValueUsd,
    tokenMarket,
    marketCap,
    poolCreated: !!poolCreated,
    raw: { devcityBalance, usdtBalance, celoBalance: celoBalance?.value, supply },
  };
}

export { getDevcityPoolId, fetchBalances };
