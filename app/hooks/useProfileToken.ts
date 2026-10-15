'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, http, zeroAddress, type Address } from 'viem';
import { celo, celoSepolia } from 'viem/chains';
import { CELO_SEPOLIA, ERC20_ABI } from '@/lib/chain';

const PROFILE_FACTORY_ABI = [
  { type: 'function', name: 'getUserToken', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const PROFILE_TOKEN_ABI = [
  ...ERC20_ABI,
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'poolCreated', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const;

const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(CELO_SEPOLIA.rpcUrl),
});

export interface ProfileTokenSummary {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  totalSupply: bigint;
  tokenURI: string;
  poolCreated: boolean;
}

export function useProfileToken(walletAddress?: string) {
  const [token, setToken] = useState<ProfileTokenSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!walletAddress) {
      setToken(null);
      return;
    }
    setLoading(true);
    try {
      const address = await publicClient.readContract({
        address: CELO_SEPOLIA.profileTokenFactory as Address,
        abi: PROFILE_FACTORY_ABI,
        functionName: 'getUserToken',
        args: [walletAddress as Address],
      });
      if (address.toLowerCase() === zeroAddress) {
        setToken(null);
        return;
      }
      const [name, symbol, decimals, totalSupply, balance, uri, poolCreated] = await Promise.all([
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'balanceOf', args: [walletAddress as Address] }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'tokenURI' }),
        publicClient.readContract({ address, abi: PROFILE_TOKEN_ABI, functionName: 'poolCreated' }),
      ]);
      setToken({
        address,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply,
        balance,
        tokenURI: uri,
        poolCreated,
      });
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  return { token, loading, reload: load };
}
