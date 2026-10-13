import { encodeFunctionData, parseAbi, type Address, type Hex, encodeAbiParameters, keccak256, toHex } from 'viem';
import { CELO_SEPOLIA, DEVCITY26_TOKEN_ABI, ERC20_ABI } from '@/lib/chain';

// ── Sell: DEVCITY26Token.burnForUSDT(amountIn, minUSDTOut, deadline) ─────
export function encodeSell(amountIn: bigint, minUSDTOut: bigint, deadline: bigint): Hex {
  return encodeFunctionData({
    abi: DEVCITY26_TOKEN_ABI as any,
    functionName: 'burnForUSDT',
    args: [amountIn, minUSDTOut, deadline],
  });
}

// ── Send: ERC20.transfer(to, amount) ────────────────────────────────────
export function encodeTransfer(token: Address, to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI as any,
    functionName: 'transfer',
    args: [to, amount],
  });
}

// ── Approve: ERC20.approve(spender, amount) ─────────────────────────────
export function encodeApprove(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI as any,
    functionName: 'approve',
    args: [spender, amount],
  });
}

// Uniswap V4 pool key for DEV26/USDT (fee 3000, tickSpacing 60, no hooks)
export function devcityPoolKey() {
  // token0 = lower address. USDT 0xd077... < DEV26 0xe6B9...
  return {
    currency0: CELO_SEPOLIA.usdt as Address,
    currency1: CELO_SEPOLIA.devcityToken as Address,
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000' as Address,
  };
}

export function computePoolId(): Hex {
  const key = devcityPoolKey();
  const encoded = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
  );
  return keccak256(encoded);
}

/**
 * UniversalRouter v4 swap command.
 * Commands: V4_SWAP = 0x10.
 * Input is ABI-encoded V4SwapParams(poolKey, SwapParams, hookData).
 * The router acts as the unlock callback, pulling the input currency via
 * Permit2 and taking the output to msg.sender.
 */
const V4_SWAP = 0x10;

interface V4SwapParams {
  poolKey: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
  params: { zeroForOne: boolean; amountSpecified: bigint; sqrtPriceLimitX96: bigint };
  hookData: Hex;
}

export function buildRouterSwapInput(swap: V4SwapParams): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)',
      },
      { type: 'tuple(bool zeroForOne,int256 amountSpecified,uint160 sqrtPriceLimitX96)' },
      { type: 'bytes' },
    ],
    [
      [swap.poolKey.currency0, swap.poolKey.currency1, swap.poolKey.fee, swap.poolKey.tickSpacing, swap.poolKey.hooks],
      [swap.params.zeroForOne, swap.params.amountSpecified, swap.params.sqrtPriceLimitX96],
      swap.hookData,
    ],
  );
}

// UniversalRouter.execute(bytes commands, bytes[] inputs, uint256 deadline)
export const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
  'function unlockCallback(bytes data) returns (bytes)',
]);

export function encodeRouterExecute(inputs: Hex[], deadline: bigint): Hex {
  const commands = toHex(Uint8Array.from(inputs.map(() => V4_SWAP)));
  return encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  });
}

/**
 * Build a USDT → DEV26 buy through the UniversalRouter.
 * zeroForOne: USDT(token0) → DEV26(token1). Exact-in (amountSpecified < 0).
 * Requires the user to have set a Permit2 allowance (USDT spender = router).
 */
export function buildBuyCallData(usdtAmountIn: bigint, minDevcityOut: bigint, deadline: bigint): Hex {
  const poolKey = devcityPoolKey();
  const swap: V4SwapParams = {
    poolKey,
    params: {
      zeroForOne: true, // token0 (USDT) -> token1 (DEV26)
      amountSpecified: -usdtAmountIn, // exact-in
      sqrtPriceLimitX96: BigInt(0),
    },
    hookData: '0x',
  };
  const input = buildRouterSwapInput(swap);
  return encodeRouterExecute([input], deadline);
}
