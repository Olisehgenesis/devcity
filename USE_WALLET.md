# USE_WALLET — Wallet Safety Rules

**Read this before touching anything wallet-related in this repo.**

## The one rule

> **NEVER read, print, log, display, or copy the private key.**
> Not in chat, not in terminal output, not in code comments, not in files, not in error messages. Ever.

## What this means in practice

- ❌ Never `cat .env`, `grep PRIVATE_KEY`, or echo any `*_PRIVATE_KEY` variable.
- ❌ Never pass a private key as a CLI argument (it lands in shell history and process lists).
- ❌ Never paste a private key into code, tests, scripts, docs, or chat messages.
- ❌ Never commit `.env` or any file containing a key to git.
- ✅ Code reads keys **only** through the environment at runtime: `process.env.DEV_WALLET_PRIVATE_KEY` (loaded by `dotenvx run --`).
- ✅ When asked about the wallet, show **only the public address** (`DEV_WALLET_ADDRESS`).
- ✅ To check a wallet exists, verify the address is set — never verify by reading the key.

## How the wallet is used here

| Purpose | How |
|---|---|
| Stored | `.env`, encrypted by dotenvx (`dotenvx set DEV_WALLET_PRIVATE_KEY ...`) |
| Loaded | `dotenvx run -- <command>` — never manually exported |
| Read in code | `process.env.DEV_WALLET_PRIVATE_KEY` inside `src/lib/signer.ts` / `contracts/interact.ts` only |
| Shown to user | Public address only (`DEV_WALLET_ADDRESS`) |
| Signing | In-process via viem (`privateKeyToAccount`) — the key never leaves the process |

## If a key is ever exposed

1. Treat it as **compromised immediately** — even if it's "just dev".
2. Generate a new wallet (`viem/accounts` → `generatePrivateKey()`), store with `dotenvx set`, show only the new public address.
3. Never reuse the old key, even for local testing.

## Funding / testnet

- Dev wallet is used on **Celo Sepolia** (testnet, chainId 11142220). Fund it from a faucet only.
- Mainnet (42220) + Safe integration is a separate, explicit step — do not enable it by default.
