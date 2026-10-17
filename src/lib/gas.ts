import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  hexToBigInt,
  http,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { ACTIVE_CHAIN } from './celo';

/** Core contract that owns the allowlist. Token addresses are read from it, not hardcoded. */
const FEE_CURRENCY_DIRECTORY: Record<number, Address> = {
  42220: '0x15F344b9E6c3Cb6F0376A36A64928b13F62C6276',
  11142220: '0x9212Fb72ae65367A7c887eC4Ad9bE310BAC611BF',
};

const DIRECTORY_ABI = [
  {
    type: 'function',
    name: 'getCurrencies',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;

const ADAPTER_ABI = [
  { type: 'function', name: 'adaptedToken', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'getAdaptedToken', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const;

const TOKEN_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const GAS_BUFFER_NUM = BigInt(120);
const GAS_BUFFER_DEN = BigInt(100);
const PRICE_BUFFER_NUM = BigInt(110);
const PRICE_BUFFER_DEN = BigInt(100);
const FALLBACK_GAS = BigInt(300000);

export type TxRequest = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

export type FeeCheck = {
  symbol: string;
  needed: string;
  balance: string;
  enough: boolean;
};

export type FeeQuote = {
  symbol: string;
  feeCurrency?: Address;
  gas: bigint;
  maxFeePerGas: bigint;
  fee: bigint;
  display: string;
  checked: FeeCheck[];
};

export class FeeUnpayableError extends Error {
  checks: FeeCheck[];

  constructor(checks: FeeCheck[]) {
    const detail = checks.map((check) => `${check.symbol}: need about ${check.needed}, balance ${check.balance}`).join('; ');
    super(`No fee currency can cover this transaction. Checked ${checks.map((check) => check.symbol).join(', ')}. ${detail}`);
    this.name = 'FeeUnpayableError';
    this.checks = checks;
  }
}

/** CELO is handled separately. USDT (including USD₮) comes before USDC, then everything else. */
export function feePreference(symbol: string): number {
  const upper = symbol.toUpperCase().replace('₮', 'T');
  if (upper === 'USDT') return 0;
  if (upper === 'USDC') return 1;
  return 2;
}

export function sortFeeSymbols(symbols: string[]): string[] {
  return [...symbols].sort((a, b) => feePreference(a) - feePreference(b) || a.localeCompare(b));
}

export function formatFeeAmount(fee: bigint): string {
  const raw = formatUnits(fee, 18);
  const [whole, fraction = ''] = raw.split('.');
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

type ListedCurrency = {
  symbol: string;
  feeCurrency: Address;
  token: Address;
};

let directoryCache: { chainId: number; at: number; list: ListedCurrency[] } | null = null;

export function feeClient(): PublicClient {
  return createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
  }) as PublicClient;
}

async function readSymbol(client: PublicClient, address: Address): Promise<string | null> {
  try {
    const symbol = await client.readContract({ address, abi: TOKEN_ABI, functionName: 'symbol' });
    return symbol?.trim() || null;
  } catch {
    return null;
  }
}

async function underlyingToken(client: PublicClient, feeCurrency: Address): Promise<Address> {
  for (const functionName of ['getAdaptedToken', 'adaptedToken'] as const) {
    try {
      const token = await client.readContract({ address: feeCurrency, abi: ADAPTER_ABI, functionName });
      if (token && token.toLowerCase() !== zeroAddress) return getAddress(token);
    } catch {
      // 18-decimal tokens are registered directly and have no adapter method.
    }
  }
  return feeCurrency;
}

export async function loadFeeCurrencies(client: PublicClient = feeClient()): Promise<ListedCurrency[]> {
  const chainId = client.chain?.id ?? ACTIVE_CHAIN.id;
  if (directoryCache && directoryCache.chainId === chainId && Date.now() - directoryCache.at < 60_000) {
    return directoryCache.list;
  }
  const directory = FEE_CURRENCY_DIRECTORY[chainId];
  if (!directory) throw new Error('This network has no fee currency directory.');
  const currencies = await client.readContract({
    address: directory,
    abi: DIRECTORY_ABI,
    functionName: 'getCurrencies',
  });
  const list: ListedCurrency[] = [];
  for (const entry of currencies) {
    const feeCurrency = getAddress(entry);
    const token = await underlyingToken(client, feeCurrency);
    const symbol = (await readSymbol(client, token)) ?? (await readSymbol(client, feeCurrency)) ?? 'TOKEN';
    list.push({ symbol, feeCurrency, token });
  }
  list.sort((a, b) => feePreference(a.symbol) - feePreference(b.symbol) || a.symbol.localeCompare(b.symbol));
  directoryCache = { chainId, at: Date.now(), list };
  return list;
}

async function gasPrice(client: PublicClient, feeCurrency?: Address): Promise<bigint> {
  const price = await client.request({
    method: 'eth_gasPrice',
    params: feeCurrency ? [feeCurrency] : [],
  } as never);
  return hexToBigInt(price as Hex);
}

async function estimate(client: PublicClient, account: Address, request: TxRequest, feeCurrency?: Address): Promise<bigint> {
  try {
    return await client.estimateGas({
      account,
      to: request.to,
      data: request.data,
      value: request.value,
      ...(feeCurrency ? { feeCurrency } : {}),
    });
  } catch {
    return FALLBACK_GAS;
  }
}

async function balanceOf(client: PublicClient, account: Address, feeCurrency?: Address): Promise<bigint> {
  if (!feeCurrency) return client.getBalance({ address: account });
  try {
    return await client.readContract({
      address: feeCurrency,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [account],
    });
  } catch {
    return BigInt(0);
  }
}

export async function quoteCeloFee(
  account: Address,
  request: TxRequest,
  client: PublicClient = feeClient(),
): Promise<FeeQuote> {
  const listed = await loadFeeCurrencies(client);
  const candidates: Array<{ symbol: string; feeCurrency?: Address }> = [
    { symbol: 'CELO' },
    ...listed.map((item) => ({ symbol: item.symbol, feeCurrency: item.feeCurrency })),
  ];
  const checked: FeeCheck[] = [];

  for (const candidate of candidates) {
    const price = (await gasPrice(client, candidate.feeCurrency)) * PRICE_BUFFER_NUM / PRICE_BUFFER_DEN;
    const gas = (await estimate(client, account, request, candidate.feeCurrency)) * GAS_BUFFER_NUM / GAS_BUFFER_DEN;
    const fee = price * gas;
    const balance = await balanceOf(client, account, candidate.feeCurrency);
    const enough = balance >= fee;
    checked.push({
      symbol: candidate.symbol,
      needed: `${formatFeeAmount(fee)} ${candidate.symbol}`,
      balance: `${formatFeeAmount(balance)} ${candidate.symbol}`,
      enough,
    });
    if (!enough) continue;
    return {
      symbol: candidate.symbol,
      feeCurrency: candidate.feeCurrency,
      gas,
      maxFeePerGas: price,
      fee,
      display: `${formatFeeAmount(fee)} ${candidate.symbol}`,
      checked,
    };
  }

  throw new FeeUnpayableError(checked);
}

export function feeTransactionFields(quote: FeeQuote): {
  gas: bigint;
  maxFeePerGas: bigint;
  feeCurrency?: Address;
} {
  return {
    gas: quote.gas,
    maxFeePerGas: quote.maxFeePerGas,
    ...(quote.feeCurrency ? { feeCurrency: quote.feeCurrency } : {}),
  };
}

type WriteArgs = {
  account?: { address: Address } | Address;
  address: Address;
  abi: readonly unknown[] | unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  chain?: unknown;
};

function accountAddress(account: WriteArgs['account'], fallback?: { address: Address }): Address {
  if (typeof account === 'string') return account;
  if (account && typeof account === 'object' && 'address' in account) return account.address;
  if (fallback?.address) return fallback.address;
  throw new Error('A wallet account is required to pay the network fee.');
}

type LooseWallet = {
  account?: { address: Address };
  writeContract: (args: never) => Promise<Hex>;
  sendTransaction: (args: never) => Promise<Hex>;
};

export async function writeContractWithFee(
  walletClient: Pick<LooseWallet, 'writeContract' | 'account'>,
  parameters: WriteArgs,
): Promise<Hex> {
  const account = accountAddress(parameters.account, walletClient.account);
  const encode = encodeFunctionData as (args: {
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) => Hex;
  const data = encode({
    abi: parameters.abi,
    functionName: parameters.functionName,
    args: parameters.args,
  });
  const quote = await quoteCeloFee(account, { to: parameters.address, data, value: parameters.value });
  const write = walletClient.writeContract as (args: WriteArgs & ReturnType<typeof feeTransactionFields>) => Promise<Hex>;
  return write({ ...parameters, ...feeTransactionFields(quote) });
}

export async function sendTransactionWithFee(
  walletClient: Pick<LooseWallet, 'sendTransaction' | 'account'>,
  parameters: { account?: { address: Address } | Address; to: Address; value?: bigint; data?: Hex },
): Promise<Hex> {
  const account = accountAddress(parameters.account, walletClient.account);
  const quote = await quoteCeloFee(account, { to: parameters.to, data: parameters.data, value: parameters.value });
  const send = walletClient.sendTransaction as (args: {
    account?: { address: Address } | Address;
    to: Address;
    value?: bigint;
    data?: Hex;
    gas?: bigint;
    maxFeePerGas?: bigint;
    feeCurrency?: Address;
  }) => Promise<Hex>;
  return send({ ...parameters, ...feeTransactionFields(quote) });
}
