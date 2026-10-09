import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

export const SUPPORTED_CHAINS = [baseSepolia, base] as const;

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({
      appName: 'DEVCITY26',
      preference: { options: 'smartWalletOnly' },
    }),
    walletConnect({ projectId }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

export const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || '';
export const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || '';

export const CONTRACT_ADDRESSES = {
  [baseSepolia.id]: {
    tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_SEPOLIA || '0x0000000000000000000000000000000000000000',
    dropManager: process.env.NEXT_PUBLIC_DROP_MANAGER_ADDRESS_SEPOLIA || '0x0000000000000000000000000000000000000000',
  },
  [base.id]: {
    tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
    dropManager: process.env.NEXT_PUBLIC_DROP_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
} as const;

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[baseSepolia.id];
}

export const TOKEN_FACTORY_ABI = [
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'maxSupply', type: 'uint256' },
      { name: 'initialSupply', type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'iconURI', type: 'string' },
    ],
    name: 'createToken',
    outputs: [{ name: 'tokenAddress', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    name: 'getToken',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'maxSupply', type: 'uint256' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'creator', type: 'address' },
      { name: 'description', type: 'string' },
      { name: 'iconURI', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'token', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
    ],
    name: 'TokenCreated',
    type: 'event',
  },
] as const;

export const DROP_MANAGER_ABI = [
  {
    inputs: [
      { name: 'dropId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'amountPerClaim', type: 'uint256' },
      { name: 'maxClaimants', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'claimAuthority', type: 'address' },
    ],
    name: 'createDrop',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'dropId', type: 'bytes32' },
      { name: 'claimant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'dropId', type: 'bytes32' }],
    name: 'getDrop',
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'amountPerClaim', type: 'uint256' },
      { name: 'maxClaimants', type: 'uint256' },
      { name: 'currentClaimants', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'claimAuthority', type: 'address' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'dropId', type: 'bytes32' }, { name: 'claimant', type: 'address' }],
    name: 'hasClaimed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'dropId', type: 'bytes32' },
      { indexed: true, name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
    ],
    name: 'DropCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'dropId', type: 'bytes32' },
      { indexed: true, name: 'claimant', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'TokensClaimed',
    type: 'event',
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
] as const;

export const CLAIM_AUTHORIZATION_TYPES = {
  ClaimAuthorization: [
    { name: 'dropId', type: 'bytes32' },
    { name: 'claimant', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;