/**
 * Local test accounts. Not part of the product. Refuses to run unless the
 * server-side dev gate passes (non-production, BETTER_AUTH_URL on localhost).
 *
 *   npm run dev:accounts -- create <username>
 *   npm run dev:accounts -- list
 *   npm run dev:accounts -- reset <username>
 *
 * create and reset print a new password once. Nothing is hardcoded.
 */
import { createDevTestAccount, generateTestPassword, listDevTestAccounts, resetDevTestAccount } from '../src/lib/dev-test-accounts';
import { DevTestAccountError } from '../src/lib/dev-test-accounts';

const [command, username] = process.argv.slice(2);

try {
  if (command === 'create') {
    if (!username) throw new Error('Usage: npm run dev:accounts -- create <username>');
    const password = generateTestPassword();
    const account = await createDevTestAccount(username, password);
    console.log(JSON.stringify({ ...account, password }));
  } else if (command === 'list') {
    console.log(JSON.stringify(await listDevTestAccounts(), null, 2));
  } else if (command === 'reset') {
    if (!username) throw new Error('Usage: npm run dev:accounts -- reset <username>');
    console.log(JSON.stringify(await resetDevTestAccount(username)));
  } else {
    throw new Error('Usage: npm run dev:accounts -- create <username> | list | reset <username>');
  }
} catch (error) {
  const message = error instanceof DevTestAccountError || error instanceof Error ? error.message : 'Test account command failed.';
  console.error(message);
  process.exit(1);
}
