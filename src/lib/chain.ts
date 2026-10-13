import { http, createConfig } from 'wagmi';
import { celo, celoSepolia } from 'wagmi/chains';
import type { Address } from 'viem';

// Real deployed contracts (Celo Sepolia) — from hardhat/deployments.json
export const CELO_SEPOLIA = {
  chainId: 11142220,
  rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
  blockExplorer: 'https://celo-sepolia.blockscout.com',
  // Uniswap V4 (official Celo Sepolia deployment)
  poolManager: '0x2af85C83CFe7bC5182F81E5aE82661b4E9F15A1e',
  positionManager: '0xB104b7c42DAB49d31fe3Ea91Dd80305348Cc37C1',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  universalRouter: '0x8891A0A682cC7f0bda7912E79C80167403d96103',
  // DEVCITY26 deployer + children
  deployer: '0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b',
  dropClaim: '0xDC202478bA251eDac1999f16cC7187Cc2770d03e',
  profileTokenFactory: '0x4836f61AC443d16F3Bf3c6acfd8140Adfe11E3ee',
  devcityToken: '0xe6B9a110c3Ce4a46DcEC6092871D21AC2b0c02Cb',
  usdt: '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
  celo: '0x471EcE3750Da237f93B8E339c536989b8978a438',
} as const;

export const CHAIN = celoSepolia;

export const wagmiConfig = createConfig({
  chains: [celoSepolia, celo],
  transports: {
    [celoSepolia.id]: http(CELO_SEPOLIA.rpcUrl),
    [celo.id]: http('https://forno.celo.org'),
  },
});

// ── ABI fragments ────────────────────────────────────────────────────────

export const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transferFrom', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { anonymous: false, inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'Transfer', type: 'event' },
] as const;

export const DEVCITY26_TOKEN_ABI = [
  ...ERC20_ABI,
  { inputs: [], name: 'MAX_SUPPLY', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'tokenURI', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolManager', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'positionManager', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'permit2', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'usdtToken', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolId', outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolCreated', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'minUSDTOut', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], name: 'burnForUSDT', outputs: [{ name: 'usdtReceived', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

export const DROP_CLAIM_ABI = [
  { inputs: [{ name: 'dropId', type: 'bytes32' }, { name: 'claimant', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], name: 'claim', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'dropId', type: 'bytes32' }], name: 'getDrop', outputs: [{ name: 'token', type: 'address' }, { name: 'totalAmount', type: 'uint256' }, { name: 'amountPerClaim', type: 'uint256' }, { name: 'maxClaimants', type: 'uint256' }, { name: 'currentClaimants', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' }, { name: 'claimAuthority', type: 'address' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }, { name: 'dropId', type: 'bytes32' }], name: 'hasUserClaimed', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserNonce', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getSigners', outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view', type: 'function' },
] as const;

// Uniswap V4 PoolManager (subset) for reading price from pool slot0.
export const POOL_MANAGER_ABI = [
  { inputs: [{ name: 'id', type: 'bytes32' }], name: 'getSlot0', outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint16' }, { name: 'tickSpacing', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

export const NATIVE_ABI = [
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

// Permit2 — for setting allowance so the UniversalRouter can pull input tokens
export const PERMIT2_ABI = [
  { inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }], name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }], stateMutability: 'view', type: 'function' },
] as const;

export type { Address };
