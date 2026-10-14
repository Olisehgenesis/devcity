# DEVCITY26 Deployment

Deployed on **Celo Sepolia** (chainId `11142220`).

## Live Addresses

| Contract | Address | Explorer |
| --- | --- | --- |
| DEVCITY26Deployer (proxy) | `0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b` | [view](https://celo-sepolia.blockscout.com/address/0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b) |
| DEVCITY26Deployer legacy implementation | `0xf81508dEd268b941fa414255ffdfF310eAA61F01` | [view](https://celo-sepolia.blockscout.com/address/0xf81508dEd268b941fa414255ffdfF310eAA61F01) |
| DEVCITY26Deployer extension (current) | `0x0e403ab627ebc0a2f2409471095872fb0e8d0c76` | [view](https://celo-sepolia.blockscout.com/address/0x0e403ab627ebc0a2f2409471095872fb0e8d0c76) |
| DropClaim (proxy) | `0xDC202478bA251eDac1999f16cC7187Cc2770d03e` | [view](https://celo-sepolia.blockscout.com/address/0xDC202478bA251eDac1999f16cC7187Cc2770d03e) |
| DropClaim (impl) | `0xb572d7eb1b0b0eea52bca1e17f41bb2dfd919364` | [view](https://celo-sepolia.blockscout.com/address/0xb572d7eb1b0b0eea52bca1e17f41bb2dfd919364) |
| ProfileTokenFactory (proxy) | `0x4836f61AC443d16F3Bf3c6acfd8140Adfe11E3ee` | [view](https://celo-sepolia.blockscout.com/address/0x4836f61AC443d16F3Bf3c6acfd8140Adfe11E3ee) |
| ProfileTokenFactory (legacy impl) | `0x3dae34e1364eb1df53ba081f0bec7f1540feda82` | [view](https://celo-sepolia.blockscout.com/address/0x3dae34e1364eb1df53ba081f0bec7f1540feda82) |
| ProfileTokenFactory (current impl) | `0x681812f14b56d91da30b0fcf85c08eef3dafb236` | [view](https://celo-sepolia.blockscout.com/address/0x681812f14b56d91da30b0fcf85c08eef3dafb236) |
| DEVCITY26Token (proxy) | `0xe6B9a110c3Ce4a46DcEC6092871D21AC2b0c02Cb` | [view](https://celo-sepolia.blockscout.com/address/0xe6B9a110c3Ce4a46DcEC6092871D21AC2b0c02Cb) |
| DEVCITY26Token (impl) | `0x877952b7fc596d46dbcb880a8171808b214d4448` | [view](https://celo-sepolia.blockscout.com/address/0x877952b7fc596d46dbcb880a8171808b214d4448) |

## Verification (Sourcify)

All contracts verified on **Sourcify** with **exact match** (runtime + creation):

| Contract | Impl/Proxy | Status |
| --- | --- | --- |
| DEVCITY26Deployer | impl | ✅ exact match |
| DropClaim | impl | ✅ exact match |
| ProfileTokenFactory | impl | ✅ exact match |
| DEVCITY26Token | impl | ✅ exact match |
| ERC1967Proxy (deployer) | proxy | ✅ exact match |

Re-run anytime with `npm run verify`.

## Wired External Contracts (Celo Sepolia, pre-deployed — not by us)

| Contract | Address |
| --- | --- |
| Uniswap V4 PoolManager | `0x2af85C83CFe7bC5182F81E5aE82661b4E9F15A1e` |
| Uniswap V4 PositionManager | `0xB104b7c42DAB49d31fe3Ea91Dd80305348Cc37C1` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| USDT (USD₮) | `0xd077A400968890Eacc75cdc901F0356c943e4fDb` |

## Token

- **Name:** DEVCITY26
- **Symbol:** DEV26
- **Max supply:** 1,000,000 DEV26
- **Token URI:** app logo embedded onchain (base64 data URI)
- **Backend signer:** admin wallet `0x96f43D594980cEf99e70429744C138247D47Dc2A` (first in list; admin can add/remove more via deployer passthroughs)

## Profile-token factory upgrade

- Price-aware initial pool creation: enabled.
- New profile-token supply: 1,000,000; 900,000 minted to the profile owner and 100,000 retained by the factory treasury.
- New profile tokens are initialized ERC-1967 proxies and support USDT buy/sell swaps without an additional protocol tax.
- The wallet's profile-token launch path was simulated against the live factory after the upgrade; no user token was created during that check.

## Re-run scripts

See `hardhat/README.md` for the full command list (`deploy`, `status`, `signers`, `add-signer`, `remove-signer`, `seed-pool`, `sync`). All run with dotenvx so the key is never exposed.
