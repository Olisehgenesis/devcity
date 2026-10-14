# DEVCITY26 Contracts — Platform Documentation

A living reference for the DEVCITY26 onchain platform: architecture, live addresses, function references, flows, and operational scripts.

**Network:** Celo Sepolia (chainId `11142220`) for testing · **Target:** Celo Mainnet (chainId `42220`)
**Standards:** ERC-20 · ERC-1967 UUPS proxies · OpenZeppelin upgradeable · Uniswap V4

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEVCITY26Deployer (UUPS proxy)                    │
│   owner/admin manages everything; deploys + wires all child contracts     │
└──────────────┬───────────────────────────────┬───────────────────────────┘
               │ deployAll()                    │
       ┌───────▼────────┐   ┌───────────────────▼───────────────────┐
       │   DropClaim     │   │      ProfileTokenFactory (UUPS)       │
       │   (UUPS proxy)  │   │   createToken → ProfileToken (ERC-20) │
       │ claims w/ signed │   │   price-aware Uniswap V4 pool launch │
       │ auth + signer    │   └───────────────────┬───────────────────┘
       │ list             │                       │ one per user
       └───────┬──────────┘   ┌───────────────────▼───────────────────┐
               │              │     DEVCITY26Token (UUPS ERC-20)       │
               │              │  platform token, V4 pool + burnForUSDT │
               │              └───────────────────┬───────────────────┘
               │                                  │
               └──────────── Uniswap V4 ─────────┘
             PoolManager · PositionManager · Permit2 · USDT
```

- **One deployer** owns/wires everything. Children are deployed behind **ERC1967 proxies**.
- **Uniswap V4 is NOT deployed by us** — we only pass its pre-existing addresses and call them through `IV4Core.sol`. `LiquidityAmounts.sol` is a pure math library inlined at compile time.
- **Backend signers** are a managed **list** (admin adds/removes) on `DropClaim`; the backend signs claim authorizations.

---

## 2. Live addresses (Celo Sepolia)

| Contract | Address (proxy unless noted) | Explorer |
| --- | --- | --- |
| DEVCITY26Deployer | `0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b` | [view](https://celo-sepolia.blockscout.com/address/0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b) |
| DEVCITY26Deployer (impl) | `0xf81508dEd268b941fa414255ffdfF310eAA61F01` | [view](https://celo-sepolia.blockscout.com/address/0xf81508dEd268b941fa414255ffdfF310eAA61F01) |
| DropClaim | `0xDC202478bA251eDac1999f16cC7187Cc2770d03e` | [view](https://celo-sepolia.blockscout.com/address/0xDC202478bA251eDac1999f16cC7187Cc2770d03e) |
| DropClaim (impl) | `0xb572d7eb1b0b0eea52bca1e17f41bb2dfd919364` | [view](https://celo-sepolia.blockscout.com/address/0xb572d7eb1b0b0eea52bca1e17f41bb2dfd919364) |
| ProfileTokenFactory | `0x4836f61AC443d16F3Bf3c6acfd8140Adfe11E3ee` | [view](https://celo-sepolia.blockscout.com/address/0x4836f61AC443d16F3Bf3c6acfd8140Adfe11E3ee) |
| ProfileTokenFactory (impl) | `0x3dae34e1364eb1df53ba081f0bec7f1540feda82` | [view](https://celo-sepolia.blockscout.com/address/0x3dae34e1364eb1df53ba081f0bec7f1540feda82) |
| DEVCITY26Token | `0xe6B9a110c3Ce4a46DcEC6092871D21AC2b0c02Cb` | [view](https://celo-sepolia.blockscout.com/address/0xe6B9a110c3Ce4a46DcEC6092871D21AC2b0c02Cb) |
| DEVCITY26Token (impl) | `0x877952b7fc596d46dbcb880a8171808b214d4448` | [view](https://celo-sepolia.blockscout.com/address/0x877952b7fc596d46dbcb880a8171808b214d4448) |

### Wired external (pre-deployed, not ours)

| Contract | Address |
| --- | --- |
| Uniswap V4 PoolManager | `0x2af85C83CFe7bC5182F81E5aE82661b4E9F15A1e` |
| Uniswap V4 PositionManager | `0xB104b7c42DAB49d31fe3Ea91Dd80305348Cc37C1` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| USDT (USD₮) | `0xd077A400968890Eacc75cdc901F0356c943e4fDb` |

---

## 3. Contracts

### 3.1 DEVCITY26Deployer
UUPS upgradeable router + factory orchestrator. All admin actions flow through here.

| Function | Visibility | Purpose |
| --- | --- | --- |
| `initialize()` | owner | init (once) |
| `deployAll(poolManager, positionManager, permit2, usdt, backendSigner, maxSupply, tokenURI)` | owner | deploys DropClaim, ProfileTokenFactory, DEVCITY26Token behind proxies; stores V4 addresses; sets first backend signer |
| `wireV4Contracts()` | owner | passes V4 addresses into DEVCITY26Token |
| `upgradeProfileTokenFactory(newImplementation)` | owner | route a factory UUPS upgrade through the deployer proxy |
| `addBackendSigner / removeBackendSigner / getBackendSigners` | owner / view | manage the DropClaim signer list |
| `createDevcityPool(amount0Desired, amount1Desired, min0, min1, deadline)` | owner | create DEV26/USDT V4 pool + initial liquidity |
| `createDrop(...)` | owner | create a drop on DropClaim (pulls tokens from caller) |
| `pauseAll / unpauseAll` | owner | emergency stop |
| `rescueTokens(token, to, amount)` | owner | recover accidental tokens |

### 3.2 DropClaim
Manages token drops with **expiring signed authorizations** and claim caps. Backend signs; user (or relayer) submits the claim.

| Function | Purpose |
| --- | --- |
| `createDrop(dropId, token, totalAmount, amountPerClaim, maxClaimants, startTime, endTime, claimAuthority, eventId, placeId)` | funds + opens a drop (creator pays tokens) |
| `claim(dropId, claimant, amount, nonce, deadline, signature)` | EIP-712 claim; verifies signer is `claimAuthority`, nonce matches, caps not exceeded |
| `addSigner / removeSigner / getSigners` | backend signer list (owner) |
| `closeDrop / withdrawExpired / withdrawDrop` | admin / permissionless refunds |
| `getDrop / hasUserClaimed / getUserNonce` | view helpers |
| `pause / unpause` | emergency |

**Claim flow (EIP-712):**
`ClaimAuthorization(bytes32 dropId,address claimant,uint256 amount,uint256 nonce,uint256 deadline)`
- Backend (authorized signer) computes nonce from `getUserNonce(claimant)`, signs within a 15-min deadline.
- Client calls `claim(...)` with that signature; contract checks `digest.recover(signature) == claimAuthority`.

### 3.3 ProfileTokenFactory
Creates **one profile token per user** (fixed supply `1,000,000`, with `900,000` minted to the profile owner and `100,000` held by the factory treasury), optionally seeds a **Uniswap V4 pool** paired with USDT, supports buy/sell swaps, and allows adding liquidity. There is no extra protocol buy/sell tax. Treasury tokens can be withdrawn only by the deployer owner through the deployer contract.

| Function | Purpose |
| --- | --- |
| `createToken(name, symbol, tokenURI)` | one token per address; factory wires V4, then transfers ownership to the user |
| `createPoolAndAddLiquidityAtPrice(amount0, amount1, min0, min1, initialSqrtPriceX96, deadline)` | initialize a new V4 pool at the reviewed contribution ratio and add initial liquidity |
| `addLiquidity(...)` | add to an existing pool at its current price |
| `supportsPriceAwarePoolLaunch()` | check whether the deployed implementation supports safe initial pricing |
| `buyWithUSDT(usdtAmountIn, minTokensOut, deadline)` on the token | swap USDT → profile token via V4 unlock/settle |
| `sellForUSDT(amountIn, minUSDTOut, deadline)` on the token | swap profile token → USDT via V4 unlock/settle; `burnForUSDT` remains as a compatibility alias |
| `withdrawTreasuryTokens(token, recipient, amount)` | withdraw a profile token's treasury reserve (deployer owner only) |
| `getUserToken / getTokenCount / getTokenAt / hasPool` | view helpers |
| `setUSDTToken` | owner updates USDT |

**Create-token flow (dynamic):**
1. Client calls `createToken(name, symbol, tokenURI)` — e.g. a user's name/symbol and the user's DiceBear avatar or uploaded image as `tokenURI` (data URI).
2. Factory deploys an initialized `ProfileToken` proxy, minting `900,000` tokens to the user and `100,000` to the factory, wires V4 contracts, and transfers token ownership to the user.
3. User acquires USDT and chooses both launch amounts; the client derives the initial V4 price from that contribution ratio, then calls `createPoolAndAddLiquidityAtPrice`.

**Celo Sepolia deployment:** The factory now uses the price-aware implementation. The deployer proxy points to a small extension that forwards existing deployer methods to its previous implementation while adding owner-only factory upgrade and treasury routes. Fresh profile-token launches create initialized ERC-1967 proxies. Tokens created under older implementations are not retroactively changed.

### 3.4 ProfileToken
The user's personal ERC-20. UUPS upgradeable; supports tipping, burning, and V4 swaps.

| Function | Purpose |
| --- | --- |
| `initialize(name, symbol, tokenURI, profileOwner, usdt, factory)` | mints 900,000 tokens to the profile owner and 100,000 to the factory treasury |
| `setTokenURI` / `setUSDTToken` / `setV4Contracts` | metadata & wiring (owner) |
| `burnForUSDT(amountIn, minUSDTOut, deadline)` | V4 swap to USDT (unlock callback implemented) |
| `tip(to, amount)` | plain transfer (tipping) |
| `burn(amount)` / `pause` / `unpause` | burn + emergency |
| `unlockCallback(data)` | V4 callback (only PoolManager) |

### 3.5 DEVCITY26Token
Platform token (`DEVCITY26` / `DEV26`). ERC-20, max supply configured at deploy (`1,000,000`), fully minted to deployer, tokenURI stored **onchain as a base64 data URI** (no offchain dependency). Same V4 swap pattern as ProfileToken.

---

## 4. Fee currency (Celo)

On Celo, users can pay gas in a **stablecoin** instead of CELO by passing `gasCurrency`. Supported fee currencies by network (priority order: **USDT → USDC → cUSD** …):

| Symbol | Celo Mainnet | Celo Sepolia |
| --- | --- | --- |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5c` | `0xCe539590e98D9F63747ff5E24e0CeC7A8F9bE2c0` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | `0x2F25deB3848C207fc8E0c34035B3Ba7fC7e2A3C9` |
| cUSD | `0x765DE816845861e75A25fCA122bb6898B9B2c9a2` | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` |
| cEUR | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA07` | — |
| cREAL | `0xe8537a3d056DA446677B9E5d6AE5beA3bCEfC335` | — |

Every onchain **write** in the app should pass `gasCurrency` = the user's chosen/available stablecoin so a new user with 0 CELO can still act.

---

## 5. Operational scripts (hardhat/)

All via dotenvx (key never exposed):

```bash
dotenvx run -- bash -c 'cd hardhat && npm run <cmd>'
```

| Command | Purpose |
| --- | --- |
| `sync` | copy latest Solidity from `../contracts` into `hardhat/contracts` |
| `compile` | compile |
| `deploy` | fresh deploy (deployer + deployAll + add admin signer) → `deployments.json` |
| `upgrade-profile-factory` | upgrade the existing Sepolia deployer and profile factory to support reviewed initial pool prices |
| `status` | print token name/symbol/supply/tokenURI/pool/USDT/signers |
| `signers` | list backend signers |
| `add-signer` / `remove-signer` | `SIGNER=0x... npm run …` |
| `seed-pool` | seed DEV26/USDT V4 liquidity (`AMOUNT0`, `AMOUNT1`) |
| `verify` | verify on Sourcify |

---

## 6. Security notes

- **Proxies:** all children UUPS; `_authorizeUpgrade` restricted to owner.
- **Reentrancy/pause:** DropClaim and ProfileToken use `ReentrancyGuard` + `Pausable`.
- **Claims:** EIP-712 typed data, nonce-replay protected, deadline-gated, signer-list controlled.
- **Server never holds user private keys.** The app wallet is a passkey EOA; the private key is encrypted (AES-GCM) on-device and only optionally backed up as **ciphertext** (`wallet_backups` table).
- **Mainnet caveat:** the deployer is ~48KB > EIP-170 mainnet limit. If targeting Celo Mainnet you must trim/split the deployer (e.g. extract the pool/liquidity helpers into a separate contract or use libraries). Celo Sepolia is unaffected.
