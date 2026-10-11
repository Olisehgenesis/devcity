// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ProfileToken.sol";
import "./interfaces/IV4Core.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/src/libraries/LiquidityAmounts.sol";

/**
 * @title ProfileTokenFactory
 * @dev UUPS upgradeable factory for creating ProfileTokens (one per user) with
 * optional Uniswap V4 pool. Each user deploys exactly one token (1M supply).
 * Can create a V4 pool paired with USDT. Factory owns the tokens, enabling it
 * to wire V4 contracts and create pools; ownership is then transferred to the
 * profile owner.
 */
contract ProfileTokenFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    using CurrencyLib for Currency;

    // Full-range tick bounds for V4 pools.
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 2^96

    mapping(address => address) public userToken;
    address[] public allTokens;
    mapping(address => bool) public poolCreated;

    // Uniswap V4 addresses (set at initialization, upgradeable).
    IPoolManager public poolManager;
    IPositionManager public positionManager;
    IPermit2 public permit2;
    address public usdtToken;

    event TokenCreated(
        address indexed token,
        address indexed owner,
        string name,
        string symbol,
        string tokenURI
    );

    event PoolCreated(
        address indexed token,
        address indexed owner,
        bytes32 poolId,
        uint256 amount0,
        uint256 amount1
    );

    event USDTTokenUpdated(address newUSDT);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the factory with Uniswap V4 addresses.
     */
    function initialize(
        address _poolManager,
        address _positionManager,
        address _permit2,
        address _usdtToken
    ) external initializer {
        require(_poolManager != address(0), "Invalid PoolManager");
        require(_positionManager != address(0), "Invalid PositionManager");
        require(_permit2 != address(0), "Invalid Permit2");
        require(_usdtToken != address(0), "Invalid USDT");

        __Ownable_init(msg.sender);

        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        permit2 = IPermit2(_permit2);
        usdtToken = _usdtToken;
    }

    /**
     * @dev Create a user's profile token (one per address).
     * Factory owns the token initially, user is the profileOwner.
     * Ownership is transferred to the user after wiring V4 contracts.
     * @param name Token name
     * @param symbol Token symbol (max 10 chars recommended)
     * @param tokenURI Metadata URI
     * @return tokenAddress Address of created token
     */
    function createToken(
        string memory name,
        string memory symbol,
        string memory tokenURI
    ) external returns (address tokenAddress) {
        require(userToken[msg.sender] == address(0), "Token already exists");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        // Factory deploys token with itself as owner, user as profileOwner.
        ProfileToken token = new ProfileToken();
        token.initialize(name, symbol, tokenURI, msg.sender, usdtToken, address(this));

        tokenAddress = address(token);
        userToken[msg.sender] = tokenAddress;
        allTokens.push(tokenAddress);

        // Factory owns the token, so it can set V4 contracts.
        token.setV4Contracts(
            address(poolManager),
            address(positionManager),
            address(permit2)
        );

        // Hand ownership of the token to the profile owner.
        token.transferOwnership(msg.sender);

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, tokenURI);
        return tokenAddress;
    }

    /**
     * @dev Create Uniswap V4 pool for a token and add initial liquidity.
     * Token owner (user) calls this after acquiring USDT.
     * Uses V4 PositionManager modifyLiquidities with MINT_POSITION + SETTLE_PAIR
     * + TAKE_PAIR actions. Tokens are pulled from the user, the exact amounts
     * consumed are settled via Permit2, and any excess is refunded.
     * @param amount0Desired Amount of token0 to add (lower address token)
     * @param amount1Desired Amount of token1 to add (higher address token)
     * @param amount0Min Minimum token0 amount (slippage)
     * @param amount1Min Minimum token1 amount (slippage)
     * @param deadline Transaction deadline
     * @return poolId The V4 pool ID
     */
    function createPoolAndAddLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external returns (bytes32 poolId) {
        address token = userToken[msg.sender];
        require(token != address(0), "No token created");
        require(!poolCreated[token], "Pool already exists");
        require(amount0Desired > 0 && amount1Desired > 0, "Amounts must be > 0");
        require(block.timestamp <= deadline, "Deadline passed");

        address token0 = token < usdtToken ? token : usdtToken;
        address token1 = token < usdtToken ? usdtToken : token;

        PoolKey memory poolKey = PoolKey({
            currency0: CurrencyLib.wrap(token0),
            currency1: CurrencyLib.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });

        // Initialize the pool at 1:1 if it does not exist yet.
        try poolManager.initialize(poolKey, SQRT_PRICE_1_1) {} catch {}

        _pullAndMint(
            token0,
            token1,
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min,
            deadline
        );

        poolId = keccak256(abi.encode(poolKey));
        ProfileToken(token).setPoolCreated(poolId);
        poolCreated[token] = true;

        emit PoolCreated(token, msg.sender, poolId, amount0Desired, amount1Desired);
        return poolId;
    }

    /**
     * @dev Add more liquidity to an existing pool.
     */
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external returns (uint256 amount0, uint256 amount1, uint128 liquidity) {
        address token = userToken[msg.sender];
        require(token != address(0), "No token created");
        require(poolCreated[token], "Pool not created");
        require(block.timestamp <= deadline, "Deadline passed");

        address token0 = token < usdtToken ? token : usdtToken;
        address token1 = token < usdtToken ? usdtToken : token;

        (amount0, amount1, liquidity) = _pullAndMint(
            token0,
            token1,
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min,
            deadline
        );

        return (amount0, amount1, liquidity);
    }

    /**
     * @dev Burn tokens for USDT via Uniswap V4 swap.
     * Called by token owner to "pay with tokens".
     * Delegates to token's burnForUSDT which implements the V4 unlock/settle.
     * @param amountIn Token amount to burn
     * @param minUSDTOut Minimum USDT out
     * @param deadline Deadline
     * @return usdtReceived USDT received
     */
    function burnForUSDT(
        uint256 amountIn,
        uint256 minUSDTOut,
        uint256 deadline
    ) external returns (uint256 usdtReceived) {
        address token = userToken[msg.sender];
        require(token != address(0), "No token created");
        require(poolCreated[token], "Pool not created");
        require(block.timestamp <= deadline, "Deadline passed");

        usdtReceived = ProfileToken(token).burnForUSDT(amountIn, minUSDTOut, deadline);
        return usdtReceived;
    }

    /**
     * @dev Get user's token address.
     */
    function getUserToken(address user) external view returns (address) {
        return userToken[user];
    }

    /**
     * @dev Get total tokens created.
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Get token at index.
     */
    function getTokenAt(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }

    /**
     * @dev Check if pool exists for token.
     */
    function hasPool(address token) external view returns (bool) {
        return poolCreated[token];
    }

    /**
     * @dev Update USDT token (owner only).
     */
    function setUSDTToken(address _usdtToken) external onlyOwner {
        require(_usdtToken != address(0), "Invalid USDT");
        usdtToken = _usdtToken;
        emit USDTTokenUpdated(_usdtToken);
    }

    // ========== Internal Helpers ==========

    /**
     * @dev Pull tokens from the user, mint a full-range position, settle the
     * exact consumed amounts via Permit2, and refund any excess to the user.
     */
    function _pullAndMint(
        address token0,
        address token1,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) internal returns (uint256 amount0, uint256 amount1, uint128 liquidity) {
        // Pull tokens from the user into the factory.
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        // Approve Permit2 so the PositionManager can pull the settled amounts.
        _approvePermit2(token0, amount0Desired);
        _approvePermit2(token1, amount1Desired);

        // Compute liquidity from the desired amounts at the current price.
        uint160 sqrtPriceX96 = _currentSqrtPrice(token0, token1);
        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            MIN_SQRT_RATIO,
            MAX_SQRT_RATIO,
            amount0Desired,
            amount1Desired
        );
        require(liquidity > 0, "Zero liquidity");

        bytes memory actions = _encodeMintActions(
            token0,
            token1,
            liquidity,
            amount0Min,
            amount1Min
        );

        positionManager.modifyLiquidities(actions, deadline);

        // Refund any excess tokens left in the factory to the user.
        (amount0, amount1) = _refundExcess(
            token0,
            token1,
            amount0Desired,
            amount1Desired
        );
        return (amount0, amount1, liquidity);
    }

    /**
     * @dev Refund any excess tokens left in the factory after settlement and
     * return the exact amounts consumed.
     */
    function _refundExcess(
        address token0,
        address token1,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) internal returns (uint256 amount0, uint256 amount1) {
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        if (bal0 > 0) IERC20(token0).safeTransfer(msg.sender, bal0);
        if (bal1 > 0) IERC20(token1).safeTransfer(msg.sender, bal1);

        amount0 = amount0Desired - bal0;
        amount1 = amount1Desired - bal1;
        return (amount0, amount1);
    }

    /**
     * @dev Encode MINT_POSITION + SETTLE_PAIR + TAKE_PAIR actions for a full-range
     * position owned by the caller.
     */
    function _encodeMintActions(
        address token0,
        address token1,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) internal view returns (bytes memory actions) {
        actions = abi.encodePacked(uint8(Actions.MINT_POSITION));
        actions = abi.encodePacked(
            actions,
            abi.encode(
                PoolKey({
                    currency0: CurrencyLib.wrap(token0),
                    currency1: CurrencyLib.wrap(token1),
                    fee: 3000,
                    tickSpacing: 60,
                    hooks: address(0)
                }),
                MIN_TICK,
                MAX_TICK,
                uint256(liquidity),
                uint128(amount0Min),
                uint128(amount1Min),
                msg.sender,
                ""
            )
        );
        actions = abi.encodePacked(actions, uint8(Actions.SETTLE_PAIR));
        actions = abi.encodePacked(
            actions,
            abi.encode(CurrencyLib.wrap(token0), CurrencyLib.wrap(token1))
        );
        actions = abi.encodePacked(actions, uint8(Actions.TAKE_PAIR));
        actions = abi.encodePacked(
            actions,
            abi.encode(CurrencyLib.wrap(token0), CurrencyLib.wrap(token1), msg.sender)
        );
        return actions;
    }

    /**
     * @dev Get the current sqrt price of the pool, or 1:1 if not initialized.
     */
    function _currentSqrtPrice(address token0, address token1) internal view returns (uint160 sqrtPriceX96) {
        PoolKey memory poolKey = PoolKey({
            currency0: CurrencyLib.wrap(token0),
            currency1: CurrencyLib.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });
        PoolId poolId = PoolId.wrap(keccak256(abi.encode(poolKey)));
        (sqrtPriceX96, , , ) = poolManager.getSlot0(poolId);
        if (sqrtPriceX96 == 0) {
            sqrtPriceX96 = SQRT_PRICE_1_1;
        }
    }

    /**
     * @dev Approve Permit2 to pull tokens from the factory.
     */
    function _approvePermit2(address token, uint256 amount) internal {
        IERC20(token).forceApprove(address(permit2), amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
