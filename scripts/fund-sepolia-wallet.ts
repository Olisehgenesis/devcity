/**
 * Opt-in Celo Sepolia funding for one test wallet. Disabled unless
 * FUND_SEPOLIA_WALLET=1 and the server-side faucet gate passes.
 * A queued result is not an on-chain payment.
 *
 *   FUND_SEPOLIA_WALLET=1 npm run dev:faucet -- 0x...
 *
 * Reads CELO_FAUCET_API_KEY from the environment. Never prints it.
 */
import { FaucetConfigError, requestSepoliaFaucet } from '../src/lib/celo-faucet';
import { devFaucetEnabled } from '../src/lib/dev-test-auth';

const address = process.argv[2] ?? '';

if (process.env.FUND_SEPOLIA_WALLET !== '1') {
  console.error('Refusing to fund a wallet. Set FUND_SEPOLIA_WALLET=1 to opt in.');
  process.exit(1);
}
if (!devFaucetEnabled()) {
  console.error('Refusing to fund a wallet outside a non-production Celo Sepolia environment.');
  process.exit(1);
}

try {
  const outcome = await requestSepoliaFaucet(address, { pollAttempts: 8, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) });
  console.log(JSON.stringify(outcome));
  if (outcome.state !== 'confirmed') process.exit(outcome.state === 'queued' ? 2 : 1);
} catch (error) {
  console.error(error instanceof FaucetConfigError ? error.message : 'The faucet request failed.');
  process.exit(1);
}
