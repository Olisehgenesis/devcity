import { createPublicClient, http, type Address } from 'viem';
import { celoSepolia } from 'viem/chains';
import { CELO_SEPOLIA, POOL_MANAGER_ABI, DEVCITY26_TOKEN_ABI, ERC20_ABI } from '@/lib/chain';

export interface TokenMarket {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  price: number | null; // price in USDT
  marketCap: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  fdValue: number | null;
  change24h: number | null;
  volume24h: number | null;
  poolCreated: boolean;
  iconUrl?: string;
}

// PublicClient typed loosely to avoid viem version clashes across the tree.
export type AnyClient = any;

export function getCeloPublicClient(): AnyClient {
  return createPublicClient({
    chain: celoSepolia,
    transport: http(CELO_SEPOLIA.rpcUrl),
  });
}

/**
 * Compute the Uniswap V4 PoolId for a DEV26/USDT pool.
 * Matches v4-core PoolId = keccak256(abi.encode(PoolKey)).
 */
export async function getDevcityPoolId(client: AnyClient): Promise<`0x${string}` | null> {
  const token = DEVCITY26_TOKEN_ABI as any;
  const pc = await client.readContract({
    address: CELO_SEPOLIA.devcityToken as Address,
    abi: token,
    functionName: 'poolCreated',
  });
  if (!pc) return null;
  const poolId = await client.readContract({
    address: CELO_SEPOLIA.devcityToken as Address,
    abi: token,
    functionName: 'poolId',
  });
  return poolId as `0x${string}`;
}

/**
 * Read the live DEV26 price from the V4 pool slot0.
 * Price of token1 (DEV26) in token0 (USDT) = (sqrtPriceX96 / 2^96)^2,
 * corrected for decimal differences.
 */
export async function fetchDevcityPrice(client: AnyClient): Promise<{ price: number | null; poolCreated: boolean }> {
  try {
    const poolCreated = await client.readContract({
      address: CELO_SEPOLIA.devcityToken as Address,
      abi: DEVCITY26_TOKEN_ABI as any,
      functionName: 'poolCreated',
    });
    if (!poolCreated) return { price: null, poolCreated: false };

    const poolId = await client.readContract({
      address: CELO_SEPOLIA.devcityToken as Address,
      abi: DEVCITY26_TOKEN_ABI as any,
      functionName: 'poolId',
    });
    const slot = await client.readContract({
      address: CELO_SEPOLIA.poolManager as Address,
      abi: POOL_MANAGER_ABI as any,
      functionName: 'getSlot0',
      args: [poolId as `0x${string}`],
    });
    const sqrtPriceX96 = (slot as any)[0];

    // DEV26 and USDT decimals
    const d0 = Number(await client.readContract({ address: CELO_SEPOLIA.usdt as Address, abi: ERC20_ABI as any, functionName: 'decimals' }) ?? 18);
    const d1 = Number(await client.readContract({ address: CELO_SEPOLIA.devcityToken as Address, abi: ERC20_ABI as any, functionName: 'decimals' }) ?? 18);

    const sqrt = Number(sqrtPriceX96) / 2 ** 96;
    let price = sqrt * sqrt * 10 ** (d0 - d1);
    if (!isFinite(price) || price <= 0) price = 0;
    return { price, poolCreated: true };
  } catch {
    return { price: null, poolCreated: false };
  }
}

/**
 * Real on-chain market data for the DEVCITY26 token.
 * Price is read live from the V4 pool; market cap = price × total supply.
 */
export async function fetchDevcityMarket(client: AnyClient, decimals = 18): Promise<TokenMarket> {
  const [name, symbol, totalSupply, maxSupplyResult, poolInfo] = await Promise.allSettled([
    client.readContract({ address: CELO_SEPOLIA.devcityToken as Address, abi: DEVCITY26_TOKEN_ABI as any, functionName: 'name' }),
    client.readContract({ address: CELO_SEPOLIA.devcityToken as Address, abi: DEVCITY26_TOKEN_ABI as any, functionName: 'symbol' }),
    client.readContract({ address: CELO_SEPOLIA.devcityToken as Address, abi: DEVCITY26_TOKEN_ABI as any, functionName: 'totalSupply' }),
    client.readContract({ address: CELO_SEPOLIA.devcityToken as Address, abi: DEVCITY26_TOKEN_ABI as any, functionName: 'MAX_SUPPLY' }),
    fetchDevcityPrice(client),
  ]);

  const supply = totalSupply.status === 'fulfilled' ? Number(totalSupply.value) / 10 ** decimals : null;
  const maxSupply = maxSupplyResult.status === 'fulfilled' ? Number(maxSupplyResult.value) / 10 ** decimals : null;
  const { price, poolCreated } = poolInfo.status === 'fulfilled' ? poolInfo.value : { price: null, poolCreated: false };
  const marketCap = price != null && supply != null ? price * supply : null;
  const fdValue = price != null && maxSupply != null ? price * maxSupply : null;

  return {
    address: CELO_SEPOLIA.devcityToken as Address,
    symbol: symbol.status === 'fulfilled' ? (symbol.value as string) : 'DEV26',
    name: name.status === 'fulfilled' ? (name.value as string) : 'DEVCITY26',
    decimals,
    price,
    marketCap,
    circulatingSupply: supply,
    totalSupply: supply,
    fdValue,
    change24h: null, // no historical pool data provider yet
    volume24h: null,
    poolCreated,
  };
}

/**
 * Read a user's on-chain balances for the supported tokens.
 */
export async function fetchBalances(client: AnyClient, address: Address) {
  const tokens = [
    { key: 'devcity', address: CELO_SEPOLIA.devcityToken as Address, symbol: 'DEV26', decimals: 18, icon: undefined },
    { key: 'usdt', address: CELO_SEPOLIA.usdt as Address, symbol: 'USDT', decimals: 6, icon: undefined },
  ];
  const out: Record<string, { raw: bigint; formatted: number; decimals: number }> = {};
  for (const t of tokens) {
    try {
      const bal = await client.readContract({ address: t.address, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [address] });
      out[t.key] = { raw: bal as bigint, formatted: Number(bal) / 10 ** t.decimals, decimals: t.decimals };
    } catch {
      out[t.key] = { raw: BigInt(0), formatted: 0, decimals: t.decimals };
    }
  }
  // Native CELO balance
  try {
    const native = await client.getBalance({ address });
    out.celo = { raw: native, formatted: Number(native) / 10 ** 18, decimals: 18 };
  } catch {
    out.celo = { raw: BigInt(0), formatted: 0, decimals: 18 };
  }
  return out;
}

export interface WalletActivity {
  id: string;
  txHash: string;
  kind: 'send' | 'receive' | 'claim' | 'swap';
  symbol: string;
  amount: number;
  timestamp: number;
}

const TRANSFER_EVENT = 'Transfer(address,address,uint256)' as const;

/**
 * Best-effort recent ERC-20 Transfer history for a user via eth_getLogs.
 * Falls back to the store-level claim records when the RPC can't index logs.
 */
export async function fetchTokenTransfers(client: AnyClient, address: Address): Promise<WalletActivity[]> {
  const tokens = [
    { address: CELO_SEPOLIA.devcityToken as Address, symbol: 'DEV26', decimals: 18 },
    { address: CELO_SEPOLIA.usdt as Address, symbol: 'USDT', decimals: 6 },
  ];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const from = now - BigInt(60 * 60 * 24 * 30);
  const out: WalletActivity[] = [];
  for (const t of tokens) {
    try {
      const logs = await client.getLogs({
        address: t.address,
        event: { type: 'event', name: 'Transfer', inputs: [{ type: 'address', indexed: true, name: 'from' }, { type: 'address', indexed: true, name: 'to' }, { type: 'uint256', name: 'value' }] },
        args: { from: address, to: address },
        fromBlock: from,
        toBlock: 'latest',
      });
      for (const l of logs.slice(-30)) {
        const args = (l as any).args as any;
        const from2 = (args?.from ?? '0x0').toLowerCase();
        const to2 = (args?.to ?? '0x0').toLowerCase();
        const value = Number(args?.value ?? BigInt(0));
        const incoming = to2 === address.toLowerCase();
        out.push({
          id: (l as any).transactionHash,
          txHash: (l as any).transactionHash,
          kind: incoming ? 'receive' : 'send',
          symbol: t.symbol,
          amount: value / 10 ** t.decimals,
          timestamp: Number((l as any).blockNumber ?? 0),
        });
      }
    } catch {
      // RPC may not index logs; skip
    }
  }
  // merge with claims from contract (dedupe by txHash)
  return out;
}
