import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { celo, celoSepolia } from 'viem/chains';
import { recoverTypedDataAddress, keccak256, toHex, zeroAddress, type Hex } from 'viem';

const isMainnet = process.env.NEXT_PUBLIC_CELO_NETWORK === 'mainnet';
export const CLAIM_CHAIN = isMainnet ? celo : celoSepolia;

export const CLAIM_DOMAIN = {
  name: 'DEVCITY26',
  version: '1',
  chainId: CLAIM_CHAIN.id,
  verifyingContract: (process.env.NEXT_PUBLIC_DROPCLAIM_ADDRESS as Hex | undefined) ?? zeroAddress,
} as const;

export const CLAIM_TYPES = {
  ClaimAuthorization: [
    { name: 'dropId', type: 'bytes32' },
    { name: 'claimant', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export type ClaimAuthMessage = {
  dropId: Hex;
  claimant: Hex;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
};

export function dropIdToBytes32(dropId: string): Hex {
  return keccak256(toHex(dropId));
}

function getSignerAccount(): PrivateKeyAccount {
  const key = process.env.DEV_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error('DEV_WALLET_PRIVATE_KEY is not set');
  }
  return privateKeyToAccount(key as Hex);
}

export function getSignerAddress(): Hex {
  return getSignerAccount().address;
}

export async function signClaimAuthorization(message: ClaimAuthMessage): Promise<Hex> {
  const account = getSignerAccount();
  return account.signTypedData({
    domain: CLAIM_DOMAIN,
    types: CLAIM_TYPES,
    primaryType: 'ClaimAuthorization',
    message,
  });
}

export async function verifyClaimAuthorization(
  message: ClaimAuthMessage,
  signature: Hex,
): Promise<boolean> {
  const recovered = await recoverTypedDataAddress({
    domain: CLAIM_DOMAIN,
    types: CLAIM_TYPES,
    primaryType: 'ClaimAuthorization',
    message,
    signature,
  });
  return recovered.toLowerCase() === getSignerAddress().toLowerCase();
}