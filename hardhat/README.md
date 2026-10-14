# DEVCITY26 Hardhat Deployment

Deploys and manages the DEVCITY26 contracts on **Celo Sepolia** (chainId `11142220`)
using the dotenvx wallet (key loaded only via `dotenvx run --`, never shown).

## Setup (once)

```bash
cd hardhat
npm install
npm run sync          # copy latest contracts from ../contracts into hardhat/contracts
npm run compile
```

## Deployment scripts (run from `hardhat/`)

All commands must be run through dotenvx so the wallet key is injected from the
root `.env` (`DEV_WALLET_PRIVATE_KEY`):

```bash
# from the repo root, with hardhat as the working dir:
dotenvx run -- bash -c 'cd hardhat && npm run deploy'
```

| Command | What it does |
| --- | --- |
| `npm run deploy` | Deploys `DEVCITY26Deployer` + proxy, runs `deployAll` (DropClaim, ProfileTokenFactory, DEVCITY26Token), adds admin as backend signer. Saves addresses to `hardhat/deployments.json`. |
| `DEVCITY_DEPLOYER_PROXY=… npm run upgrade-profile-factory` | Upgrades the existing deployer to a size-limited forwarding extension and upgrades the profile-token factory for price-aware seeding, initialized token proxies, owner-only treasury withdrawals, and buy/sell swaps. New tokens use a 90% owner / 10% factory-treasury allocation. Requires the deployer owner key. |
| `npm run status` | Reads deployed addresses from `deployments.json`, prints token name/symbol/supply/tokenURI/poolManager/USDT/signers. |
| `npm run signers` | Lists authorized backend signers. |
| `npm run add-signer` | Adds a signer: `SIGNER=0x... npm run add-signer` |
| `npm run remove-signer` | Removes a signer: `SIGNER=0x... npm run remove-signer` |
| `npm run seed-pool` | Seeds DEVCITY26/USDT liquidity on Uniswap V4 (full range). Optional `AMOUNT0`, `AMOUNT1`. |
| `npm run sync` | Copies latest Solidity from `../contracts` into `hardhat/contracts`. |

## Network config

- RPC: `https://forno.celo-sepolia.celo-testnet.org` (override with `CELO_RPC_URL`)
- Uniswap V4 (already deployed — not redeployed by us): PoolManager, PositionManager, Permit2
- USDT (USD₮): `0xd077A400968890Eacc75cdc901F0356c943e4fDb`

## Notes

- Contracts are copied from `../contracts` (canonical source). Edit contracts there,
  then `npm run sync` and recompile.
- `deployments.json` is gitignored-agnostic but not committed (contains only public
  addresses, safe to commit if you want).
- Token icon is stored onchain as a base64 data URI in `DEVCITY26Token.tokenURI`.
- Backend signer is a list managed by the admin (deployer owner) via the deployer
  passthroughs: `addBackendSigner` / `removeBackendSigner` / `getBackendSigners`.
