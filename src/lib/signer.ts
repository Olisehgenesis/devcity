import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { celoSepolia } from 'viem/chains';
import { recoverTypedDataAddress, keccak256, toHex, zeroAddress, type Hex } from 'viem';

/**
 * EIP-712 signing proxy for DEVCITY26.
 *
 * The chain is Celo (mainnet chainId 42220, testnet Celo Sepolia 11142220).
 * We use Celo Sepolia for development. The proxy signs authorizations for
 * ADMIN functions (e.g. claim authorizations); the USER submits the actual
 * transaction with their own gas (no paymaster relaying).
 *
 * Domain + types MUST match contracts/DropClaim.sol:
 *   EIP712("DEVCITY26", "1")
 *   ClaimAuth(bytes32 dropId, address claimer, uint256 nonce, uint256 expiresAt)
 */
export const CLAIM_CHAIN = celoSepolia;

export const CLAIM_DOMAIN = {
  name: 'DEVCITY26',
  version: '1',
  chainId: CLAIM_CHAIN.id,
  verifyingContract: (process.env.NEXT_PUBLIC_DROPCLAIM_ADDRESS as Hex | undefined) ?? zeroAddress,
} as const;

export const CLAIM_TYPES = {
  ClaimAuth: [
    { name: 'dropId', type: 'bytes32' },
    { name: 'claimer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

export type ClaimAuthMessage = {
  dropId: Hex;
  claimer: Hex;
  nonce: bigint;
  expiresAt: bigint;
};

/** Hash the human-readable drop id to the bytes32 used on-chain. */
export function dropIdToBytes32(dropId: string): Hex {
  return keccak256(toHex(dropId));
}

function getSignerAccount(): PrivateKeyAccount {
  const key = process.env.DEV_WALLET_PRIVATE_KEY ?? process.env.CLAIM_SIGNER_PRIVATE_KEY;
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
    primaryType: 'ClaimAuth',
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
    primaryType: 'ClaimAuth',
    message,
    signature,
  });
  return recovered.toLowerCase() === getSignerAddress().toLowerCase();
}
