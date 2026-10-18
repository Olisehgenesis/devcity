export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const CELO_MAINNET_CHAIN_ID = 42220;

export function assertSafeWriteChain(
  chainId: number,
  env: { NODE_ENV?: string } = process.env,
): void {
  const production = env.NODE_ENV === "production";
  if (!production && chainId === CELO_MAINNET_CHAIN_ID) {
    throw new Error("Refusing to send a Celo mainnet transaction from a non-production environment.");
  }
  if (!production && chainId !== CELO_SEPOLIA_CHAIN_ID) {
    throw new Error(`Development writes must use Celo Sepolia (${CELO_SEPOLIA_CHAIN_ID}).`);
  }
}
