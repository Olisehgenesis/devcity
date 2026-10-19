import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC20_ABI, PERMIT2_ABI } from './chain';
import { ACTIVE_CHAIN, feeCurrenciesFor } from './celo';
import { sendTransactionWithFee, writeContractWithFee } from './gas';

const QUOTE_TTL_MS = 30_000;
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;
const FEE_TIERS = [
  { fee: 100, tickSpacing: 1 },
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 10000, tickSpacing: 200 },
] as const;

const ROUTES: Record<number, {
  mentoRouter: Address;
  mentoFactory: Address;
  quoter: Address;
  universalRouter: Address;
  permit2: Address;
}> = {
  42220: {
    mentoRouter: '0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6',
    mentoFactory: '0xa849b475FE5a4B5C9C3280152c7a1945b907613b',
    quoter: '0x28566da1093609182dff2cb2a91cfd72e61d66cd',
    universalRouter: '0xcb695bc5d3aa22cad1e6df07801b061a05a0233a',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  11142220: {
    mentoRouter: '0xcf6cD45210b3ffE3cA28379C4683F1e60D0C2CCd',
    mentoFactory: '0x353ED52bF8482027C0e0b9e3c0e5d96A9F680980',
    quoter: '0xca5E523FA87c7dC67762c8E7f4a65783899b3c72',
    universalRouter: '0x8891A0A682cC7f0bda7912E79C80167403d96103',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
};

const MENTO_ABI = parseAbi([
  'function getAmountsOut(uint256 amountIn, (address from, address to, address factory)[] routes) view returns (uint256[])',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, address factory)[] routes, address to, uint256 deadline) returns (uint256[])',
]);

const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
]);

const ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
]);

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
});

export type SwapAsset = {
  symbol: string;
  address: Address;
  decimals: number;
  native: boolean;
};

export type MentoRoute = { from: Address; to: Address; factory: Address };

export type MentoLeg = {
  venue: 'Mento';
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  routes: MentoRoute[];
};

export type UniswapLeg = {
  venue: 'Uniswap';
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  zeroForOne: boolean;
};

export type SwapLeg = MentoLeg | UniswapLeg;

export type SwapQuote = {
  legs: SwapLeg[];
  amountIn: bigint;
  amountOut: bigint;
  quotedAt: number;
};

function venueConfig() {
  const config = ROUTES[ACTIVE_CHAIN.id];
  if (!config) throw new Error('Swaps are not configured for this network.');
  return config;
}

export function swapAsset(symbol: string): SwapAsset | null {
  if (symbol === 'CELO') {
    return { symbol, address: zeroAddress, decimals: 18, native: true };
  }
  const token = feeCurrenciesFor(ACTIVE_CHAIN.id).find((item) => item.symbol === symbol);
  if (!token) return null;
  return { symbol, address: getAddress(token.address), decimals: token.decimals, native: false };
}

export function quoteIsFresh(quote: SwapQuote, now = Date.now()) {
  return now - quote.quotedAt < QUOTE_TTL_MS;
}

export function minimumOut(amountOut: bigint, slippagePercent: number) {
  const bps = BigInt(Math.round(slippagePercent * 100));
  if (bps < BigInt(0) || bps >= BigInt(10000)) throw new Error('Choose a slippage between 0 and 100.');
  return (amountOut * (BigInt(10000) - bps)) / BigInt(10000);
}

export function formatTokenAmount(amount: bigint, decimals: number) {
  const [whole, fraction = ''] = formatUnits(amount, decimals).split('.');
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function routeLabel(quote: SwapQuote) {
  const names = quote.legs.map((leg) => leg.venue);
  return names.filter((name, index) => name !== names[index - 1]).join(', then ');
}

function hubAddress(): Address | null {
  return swapAsset('USDm')?.address ?? null;
}

function bridgeAssets(from: Address, to: Address) {
  return feeCurrenciesFor(ACTIVE_CHAIN.id)
    .map((token) => getAddress(token.address))
    .filter((address) => address !== from && address !== to);
}

async function mentoAmounts(amountIn: bigint, routes: MentoRoute[]) {
  const config = venueConfig();
  try {
    const amounts = await publicClient.readContract({
      address: config.mentoRouter,
      abi: MENTO_ABI,
      functionName: 'getAmountsOut',
      args: [amountIn, routes],
    });
    const amountOut = amounts[amounts.length - 1];
    if (amountOut == null || amountOut <= BigInt(0)) return null;
    return amountOut;
  } catch {
    return null;
  }
}

async function quoteMento(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<MentoLeg | null> {
  if (tokenIn === zeroAddress || tokenOut === zeroAddress || tokenIn === tokenOut) return null;
  const config = venueConfig();
  const direct: MentoRoute[] = [{ from: tokenIn, to: tokenOut, factory: config.mentoFactory }];
  const directOut = await mentoAmounts(amountIn, direct);
  const hub = hubAddress();
  let via: MentoRoute[] | null = null;
  let viaOut: bigint | null = null;
  if (hub && tokenIn !== hub && tokenOut !== hub) {
    via = [
      { from: tokenIn, to: hub, factory: config.mentoFactory },
      { from: hub, to: tokenOut, factory: config.mentoFactory },
    ];
    viaOut = await mentoAmounts(amountIn, via);
  }
  if (directOut != null && (viaOut == null || directOut >= viaOut)) {
    return { venue: 'Mento', tokenIn, tokenOut, amountIn, amountOut: directOut, routes: direct };
  }
  if (via && viaOut != null) {
    return { venue: 'Mento', tokenIn, tokenOut, amountIn, amountOut: viaOut, routes: via };
  }
  return null;
}

async function quoteUniswap(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<UniswapLeg | null> {
  if (tokenIn === tokenOut || amountIn <= BigInt(0) || amountIn > (BigInt(1) << BigInt(128)) - BigInt(1)) return null;
  const config = venueConfig();
  const [currency0, currency1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
    ? [tokenIn, tokenOut]
    : [tokenOut, tokenIn];
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();
  const quotes = await Promise.all(FEE_TIERS.map(async (tier) => {
    try {
      const quoted = await publicClient.readContract({
        address: config.quoter,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          poolKey: {
            currency0,
            currency1,
            fee: tier.fee,
            tickSpacing: tier.tickSpacing,
            hooks: zeroAddress,
          },
          zeroForOne,
          exactAmount: amountIn,
          hookData: '0x',
        }],
      }) as readonly [bigint, bigint];
      const amountOut = quoted[0];
      if (amountOut <= BigInt(0)) return null;
      return {
        venue: 'Uniswap' as const,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        currency0,
        currency1,
        fee: tier.fee,
        tickSpacing: tier.tickSpacing,
        zeroForOne,
      };
    } catch {
      return null;
    }
  }));
  return quotes.reduce<UniswapLeg | null>((best, quote) => {
    if (!quote) return best;
    if (!best || quote.amountOut > best.amountOut) return quote;
    return best;
  }, null);
}

async function quoteDirect(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<SwapLeg | null> {
  const [mento, uniswap] = await Promise.all([
    quoteMento(tokenIn, tokenOut, amountIn),
    quoteUniswap(tokenIn, tokenOut, amountIn),
  ]);
  if (mento && uniswap) return mento.amountOut >= uniswap.amountOut ? mento : uniswap;
  return mento ?? uniswap;
}

export async function quoteSwap(tokenIn: SwapAsset, tokenOut: SwapAsset, amountIn: bigint): Promise<SwapQuote | null> {
  if (amountIn <= BigInt(0) || tokenIn.address === tokenOut.address) return null;
  const direct = await quoteDirect(tokenIn.address, tokenOut.address, amountIn);
  if (direct) {
    return { legs: [direct], amountIn, amountOut: direct.amountOut, quotedAt: Date.now() };
  }
  const bridges = await Promise.all(bridgeAssets(tokenIn.address, tokenOut.address).map(async (mid) => {
    const first = await quoteDirect(tokenIn.address, mid, amountIn);
    if (!first) return null;
    const second = await quoteDirect(mid, tokenOut.address, first.amountOut);
    if (!second) return null;
    return { legs: [first, second], amountOut: second.amountOut };
  }));
  const best = bridges.reduce<{ legs: SwapLeg[]; amountOut: bigint } | null>((chosen, quote) => {
    if (!quote) return chosen;
    if (!chosen || quote.amountOut > chosen.amountOut) return quote;
    return chosen;
  }, null);
  if (!best) return null;
  return { legs: best.legs, amountIn, amountOut: best.amountOut, quotedAt: Date.now() };
}

function uniswapCalldata(leg: UniswapLeg, amountOutMin: bigint, deadline: bigint): Hex {
  const swapParams = encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountIn', type: 'uint128' },
        { name: 'amountOutMinimum', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }],
    [{
      currency0: leg.currency0,
      currency1: leg.currency1,
      fee: leg.fee,
      tickSpacing: leg.tickSpacing,
      hooks: zeroAddress,
      zeroForOne: leg.zeroForOne,
      amountIn: leg.amountIn,
      amountOutMinimum: amountOutMin,
      hookData: '0x' as Hex,
    }],
  );
  const settle = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [leg.tokenIn, leg.amountIn],
  );
  const take = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [leg.tokenOut, amountOutMin],
  );
  const actions = encodePacked(['uint8', 'uint8', 'uint8'], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
  const input = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actions, [swapParams, settle, take]],
  );
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'execute',
    args: [encodePacked(['uint8'], [0x10]), [input], deadline],
  });
}

export function swapTransaction(quote: SwapQuote, recipient: Address, slippagePercent: number) {
  const leg = quote.legs[0];
  if (!leg) throw new Error('This quote has no route.');
  const config = venueConfig();
  const amountOutMin = minimumOut(leg.amountOut, slippagePercent);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
  if (leg.venue === 'Mento') {
    return {
      to: config.mentoRouter,
      value: BigInt(0),
      data: encodeFunctionData({
        abi: MENTO_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [leg.amountIn, amountOutMin, leg.routes, recipient, deadline],
      }),
    };
  }
  return {
    to: config.universalRouter,
    value: leg.tokenIn === zeroAddress ? leg.amountIn : BigInt(0),
    data: uniswapCalldata(leg, amountOutMin, deadline),
  };
}

async function allowanceOf(token: Address, owner: Address, spender: Address) {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, spender],
  });
}

async function tokenBalance(owner: Address, token: Address) {
  if (token === zeroAddress) return publicClient.getBalance({ address: owner });
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  });
}

async function approveIfNeeded(
  wallet: Parameters<typeof writeContractWithFee>[0],
  account: { address: Address },
  token: Address,
  spender: Address,
  amount: bigint,
  preferSymbol?: string,
) {
  const current = await allowanceOf(token, account.address, spender);
  if (current >= amount) return;
  const hash = await writeContractWithFee(wallet, {
    account,
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
  }, { preferSymbol });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error('The swap was rejected by the network. Nothing was exchanged.');
}

async function permitRouter(
  wallet: Parameters<typeof writeContractWithFee>[0],
  account: { address: Address },
  token: Address,
  amount: bigint,
  preferSymbol?: string,
) {
  const config = venueConfig();
  await approveIfNeeded(wallet, account, token, config.permit2, amount, preferSymbol);
  const allowance = await publicClient.readContract({
    address: config.permit2,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: [account.address, token, config.universalRouter],
  });
  const allowed = allowance[0];
  const expiration = allowance[1];
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (BigInt(allowed) >= amount && BigInt(expiration) > now + BigInt(60)) return;
  if (amount > (BigInt(1) << BigInt(160)) - BigInt(1)) throw new Error('Amount is too large for this Uniswap route.');
  const hash = await writeContractWithFee(wallet, {
    account,
    address: config.permit2,
    abi: PERMIT2_ABI,
    functionName: 'approve',
    args: [token, config.universalRouter, amount, Number(now + BigInt(3600))],
  }, { preferSymbol });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error('The swap was rejected by the network. Nothing was exchanged.');
}

async function executeLeg(
  wallet: { writeContract: (args: never) => Promise<Hex>; sendTransaction: (args: never) => Promise<Hex>; account: { address: Address } },
  account: ReturnType<typeof privateKeyToAccount>,
  leg: SwapLeg,
  recipient: Address,
  amountOutMin: bigint,
  preferSymbol?: string,
) {
  const config = venueConfig();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
  if (leg.venue === 'Mento') {
    await approveIfNeeded(wallet, account, leg.tokenIn, config.mentoRouter, leg.amountIn, preferSymbol);
    const hash = await writeContractWithFee(wallet, {
      account,
      address: config.mentoRouter,
      abi: MENTO_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [leg.amountIn, amountOutMin, leg.routes, recipient, deadline],
    }, { preferSymbol });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error('The swap was rejected by the network. Nothing was exchanged.');
    return hash;
  }
  if (leg.tokenIn !== zeroAddress) {
    await permitRouter(wallet, account, leg.tokenIn, leg.amountIn, preferSymbol);
  }
  const hash = await sendTransactionWithFee(wallet, {
    account,
    to: config.universalRouter,
    data: uniswapCalldata(leg, amountOutMin, deadline),
    value: leg.tokenIn === zeroAddress ? leg.amountIn : BigInt(0),
  }, { preferSymbol });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error('The swap was rejected by the network. Nothing was exchanged.');
  return hash;
}

export async function executeSwap(options: {
  quote: SwapQuote;
  privateKey: Hex;
  recipient: Address;
  slippagePercent: number;
  preferSymbol?: string;
}) {
  if (!quoteIsFresh(options.quote)) throw new Error('This quote expired. Preview the swap again.');
  const floor = minimumOut(options.quote.amountOut, options.slippagePercent);
  if (floor <= BigInt(0)) throw new Error('The quoted amount is too small for this slippage.');
  const account = privateKeyToAccount(options.privateKey);
  const wallet = createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(ACTIVE_CHAIN.rpcUrls.default.http[0]),
  });
  let hash: Hex | null = null;
  let received = options.quote.amountIn;
  for (let index = 0; index < options.quote.legs.length; index += 1) {
    const quoted = options.quote.legs[index];
    let leg = quoted;
    if (index > 0) {
      const refreshed = await quoteDirect(quoted.tokenIn, quoted.tokenOut, received);
      if (!refreshed) throw new Error('The first swap confirmed, but the next route is no longer available. Preview again before continuing.');
      if (refreshed.amountOut < floor) {
        throw new Error('The price moved past your minimum. The first transaction confirmed. Preview again before continuing.');
      }
      leg = refreshed;
    }
    const before = await tokenBalance(account.address, leg.tokenOut);
    const legMin = index === options.quote.legs.length - 1 ? floor : minimumOut(leg.amountOut, options.slippagePercent);
    hash = await executeLeg(wallet, account, leg, options.recipient, legMin, options.preferSymbol);
    if (index < options.quote.legs.length - 1) {
      const after = await tokenBalance(account.address, leg.tokenOut);
      received = after > before ? after - before : BigInt(0);
      if (received <= BigInt(0)) throw new Error('The swap confirmed, but the received amount was too small to continue.');
    }
  }
  if (!hash) throw new Error('No swap was sent.');
  return { hash };
}

function swapAssetByAddress(address: Address): SwapAsset | null {
  if (address === zeroAddress) return swapAsset('CELO');
  const token = feeCurrenciesFor(ACTIVE_CHAIN.id).find((item) => item.address.toLowerCase() === address.toLowerCase());
  return token ? { symbol: token.symbol, address: getAddress(token.address), decimals: token.decimals, native: false } : null;
}

export function explorerTxUrl(hash: Hex) {
  const base = ACTIVE_CHAIN.blockExplorers?.default.url?.replace(/\/$/, '');
  return base ? `${base}/tx/${hash}` : null;
}
