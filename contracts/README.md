# DEVCITY26 Smart Contracts

Solidity contracts for the DEVCITY26 platform on Base Sepolia.

## Contracts

### TokenFactory.sol

**Purpose:** Create ERC20 tokens with immutable max supply.

**Key Features:**
- `CityToken`: ERC20 with immutable `maxSupply`
- Pausable transfers
- Creator-owned minting (respects max supply)
- Token metadata URI

**Usage:**
```solidity
TokenFactory factory = new TokenFactory();
address token = factory.createToken(
    "DEVCON 2026",
    "DEV26",
    100000 ether,  // maxSupply
    10000 ether,   // initialSupply
    "ipfs://..."
);
```

### DropClaim.sol

**Purpose:** Manage token drops with expiring signed authorizations and claim caps.

**Key Features:**
- Drops with max claimants and expiry
- EIP-712 signed authorizations (backend validates QR, geofence, limits)
- Per-wallet and per-drop sponsorship budgets
- One-claim-per-user enforcement
- Nonce-based replay protection

**Flow:**
1. Backend creates drop with `createDrop()`
2. User scans QR or enters geofence
3. Backend validates eligibility and signs authorization
4. User calls `claim()` with signature
5. Contract verifies signature, checks budgets, transfers tokens

**Usage:**
```solidity
DropClaim dropClaim = new DropClaim(backendSigner);

// Create drop
bytes32 dropId = keccak256(abi.encode("drop-1"));
dropClaim.createDrop(
    dropId,
    tokenAddress,
    10 ether,      // amountPerClaim
    1000,          // maxClaimants
    block.timestamp + 1 days
);

// User claims with signed authorization
dropClaim.claim(dropId, nonce, expiresAt, signature);
```

### SimplePaymaster.sol

**Purpose:** Basic gas sponsorship for claims (testnet only).

**Note:** For production, use a maintained service:
- [Pimlico](https://www.pimlico.io/)
- [Alchemy](https://www.alchemy.com/)
- [Stackup](https://www.stackup.sh/)

## Deployment

### Base Sepolia

```bash
# Install dependencies
npm install

# Compile
npx hardhat compile

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### Environment Variables

```env
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_PRIVATE_KEY=0x...
BASE_ETHERSCAN_API_KEY=...
```

## Security Considerations

1. **Backend Signer:** Keep the private key secure. Rotate regularly.
2. **Budgets:** Set conservative limits to prevent abuse.
3. **Expiry:** All authorizations expire; no indefinite claims.
4. **Nonce:** Prevents replay attacks.
5. **Audit:** Get an independent security audit before mainnet.

## Testing

```bash
npx hardhat test
```

## Integration with Frontend

1. Backend signs claims with EIP-712
2. Frontend submits signature to `DropClaim.claim()`
3. Contract verifies and transfers tokens
4. Frontend shows claim confirmation

See `src/lib/contracts.ts` for integration helpers.
