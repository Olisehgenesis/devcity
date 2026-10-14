import { createConfig, http } from 'wagmi';
import { celo, celoSepolia } from 'viem/chains';

// Passkey-backed EOA wallets — no injected/browser/coinbase connectors.
// Reading balances and dispatching transactions is done with a viem account
// derived from the passkey-encrypted private key (see ./keystore.ts).
export const SUPPORTED_CHAINS = [celoSepolia, celo] as const;

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  transports: {
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org'),
    [celo.id]: http('https://forno.celo.org'),
  },
});
