import { createPublicClient, http, type Address, type Hex, type TransactionReceipt } from 'viem';
import { CELO_SEPOLIA, DROP_CLAIM_ABI } from './chain';
import { CLAIM_CHAIN } from './signer';

function client() {
  return createPublicClient({
    chain: CLAIM_CHAIN,
    transport: http(CELO_SEPOLIA.rpcUrl, { timeout: 12_000 }),
  });
}

export async function readClaimNonce(claimer: Address): Promise<bigint> {
  return client().readContract({
    address: CELO_SEPOLIA.dropClaim,
    abi: DROP_CLAIM_ABI,
    functionName: 'getUserNonce',
    args: [claimer],
  });
}

export async function readSuccessfulReceipt(hash: Hex): Promise<TransactionReceipt> {
  const receipt = await client().getTransactionReceipt({ hash });
  return receipt;
}

export async function readTransaction(hash: Hex) {
  return client().getTransaction({ hash });
}
