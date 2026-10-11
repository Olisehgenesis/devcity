// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DropClaim.sol";
import "./ProfileTokenFactory.sol";
import "./DEVCITY26Token.sol";
import "./interfaces/IV4Core.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/src/libraries/LiquidityAmounts.sol";

/**
 * @title DEVCITY26Deployer
 * @dev UUPS upgradeable deployer that deploys and wires all DEVCITY26 contracts
 * behind ERC1967 proxies. Uniswap V4 addresses are supplied per-network by the
 * deploy scripts (Celo Sepolia vs Celo Mainnet).
 */
contract DEVCITY26Deployer is
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

    // Core contracts (proxies).
    DropClaim public dropClaim;
    ProfileTokenFactory public profileTokenFactory;
    DEVCITY26Token public devcityToken;

    // Uniswap V4 addresses (set per-network at deployAll).
    address public poolManager;
    address public positionManager;
    address public permit2;
    address public usdtToken;

    event ContractsDeployed(
        address dropClaim,
        address profileTokenFactory,
        address devcityToken
    );
    event ContractWired(string contractName, address target);
    event V4PoolCreated(bytes32 poolId, address token);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the deployer.
     */
    function initialize() external initializer {
        __Ownable_init(msg.sender);
    }

    /**
     * @dev Deploy all contracts behind proxies and wire them together.
     * @param _poolManager V4 PoolManager address (network-specific)
     * @param _positionManager V4 PositionManager address (network-specific)
     * @param _permit2 Permit2 address (network-specific)
     * @param _usdtToken USDT token address (network-specific)
     * @param backendSigner Backend signer for drop claims
     * @param devcityMaxSupply Max supply for DEVCITY26 token
     * @param devcityTokenURI Metadata URI for DEVCITY26 token
     */
    function deployAll(
        address _poolManager,
        address _positionManager,
        address _permit2,
        address _usdtToken,
        address backendSigner,
        uint256 devcityMaxSupply,
        string memory devcityTokenURI
    ) external onlyOwner {
        require(_poolManager != address(0), "Invalid PoolManager");
        require(_positionManager != address(0), "Invalid PositionManager");
        require(_permit2 != address(0), "Invalid Permit2");
        require(_usdtToken != address(0), "Invalid USDT");
        require(backendSigner != address(0), "Invalid backend signer");
        require(devcityMaxSupply > 0, "Max supply must be > 0");
        require(bytes(devcityTokenURI).length > 0, "Token URI required");
        require(address(dropClaim) == address(0), "Already deployed");

        poolManager = _poolManager;
        positionManager = _positionManager;
        permit2 = _permit2;
        usdtToken = _usdtToken;

        // Deploy DropClaim behind a proxy.
        dropClaim = DropClaim(address(new ERC1967Proxy(address(new DropClaim()), "")));
        dropClaim.initialize();
        emit ContractWired("DropClaim", address(dropClaim));

        // Deploy ProfileTokenFactory behind a proxy.
        profileTokenFactory = ProfileTokenFactory(
            address(new ERC1967Proxy(address(new ProfileTokenFactory()), ""))
        );
        profileTokenFactory.initialize(_poolManager, _positionManager, _permit2, _usdtToken);
        emit ContractWired("ProfileTokenFactory", address(profileTokenFactory));

        // Deploy DEVCITY26Token behind a proxy.
        devcityToken = DEVCITY26Token(
            address(new ERC1967Proxy(address(new DEVCITY26Token()), ""))
        );
        devcityToken.initialize(
            "DEVCITY26",
            "DEV26",
            devcityMaxSupply,
            devcityTokenURI,
            _usdtToken
        );
        emit ContractWired("DEVCITY26Token", address(devcityToken));

        emit ContractsDeployed(
            address(dropClaim),
            address(profileTokenFactory),
            address(devcityToken)
        );
    }

    /**
     * @dev Wire V4 contracts to deployed tokens (call after deployment).
     */
    function wireV4Contracts() external onlyOwner {
        require(address(devcityToken) != address(0), "DEVCITY26 not deployed");
        devcityToken.setV4Contracts(poolManager, positionManager, permit2);
        emit ContractWired("DEVCITY26Token.V4", poolManager);
    }

    /**
     * @dev Create DEVCITY26/USDT pool and add initial liquidity.
     * Uses V4 PositionManager modifyLiquidities with MINT_POSITION + SETTLE_PAIR
     * + TAKE_PAIR actions. Tokens are pulled from the caller, the exact amounts
     * consumed are settled via Permit2, and any excess is refunded.
     */
    function createDevcityPool(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external onlyOwner returns (bytes32 poolId) {
        require(address(devcityToken) != address(0), "DEVCITY26 not deployed");
        require(block.timestamp <= deadline, "Deadline passed");

        address token0 = address(devcityToken) < usdtToken ? address(devcityToken) : usdtToken;
        address token1 = address(devcityToken) < usdtToken ? usdtToken : address(devcityToken);

        PoolKey memory poolKey = PoolKey({
            currency0: CurrencyLib.wrap(token0),
            currency1: CurrencyLib.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });

        // Initialize the pool at 1:1 if it does not exist yet.
        try IPoolManager(poolManager).initialize(poolKey, SQRT_PRICE_1_1) {} catch {}

        // Pull tokens from the caller into the deployer.
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        // Approve Permit2 so the PositionManager can pull the settled amounts.
        IERC20(token0).forceApprove(permit2, amount0Desired);
        IERC20(token1).forceApprove(permit2, amount1Desired);

        // Compute liquidity from the desired amounts at the current price.
        uint160 sqrtPriceX96 = _currentSqrtPrice(token0, token1);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            MIN_SQRT_RATIO,
            MAX_SQRT_RATIO,
            amount0Desired,
            amount1Desired
        );
        require(liquidity > 0, "Zero liquidity");

        // Encode MINT_POSITION + SETTLE_PAIR + TAKE_PAIR actions.
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            abi.encode(
                poolKey,
                MIN_TICK,
                MAX_TICK,
                uint256(liquidity),
                uint128(amount0Min),
                uint128(amount1Min),
                msg.sender,
                ""
            ),
            uint8(Actions.SETTLE_PAIR),
            abi.encode(CurrencyLib.wrap(token0), CurrencyLib.wrap(token1)),
            uint8(Actions.TAKE_PAIR),
            abi.encode(CurrencyLib.wrap(token0), CurrencyLib.wrap(token1), msg.sender)
        );

        IPositionManager(positionManager).modifyLiquidities(actions, deadline);

        // Refund any excess tokens left in the deployer to the caller.
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        if (bal0 > 0) IERC20(token0).safeTransfer(msg.sender, bal0);
        if (bal1 > 0) IERC20(token1).safeTransfer(msg.sender, bal1);

        poolId = keccak256(abi.encode(poolKey));
        devcityToken.setPoolCreated(poolId);

        emit V4PoolCreated(poolId, address(devcityToken));
        return poolId;
    }

    /**
     * @dev Create a drop via DropClaim (admin only).
     * Pulls tokens from caller (should be backend wallet).
     */
    function createDrop(
        bytes32 dropId,
        address token,
        uint256 totalAmount,
        uint256 amountPerClaim,
        uint256 maxClaimants,
        uint256 startTime,
        uint256 endTime,
        address claimAuthority,
        bytes32 eventId,
        bytes32 placeId
    ) external onlyOwner {
        require(address(dropClaim) != address(0), "DropClaim not deployed");
        dropClaim.createDrop(
            dropId, token, totalAmount, amountPerClaim, maxClaimants,
            startTime, endTime, claimAuthority, eventId, placeId
        );
        emit ContractWired("DropCreated", token);
    }

    /**
     * @dev Pause all contracts (emergency).
     */
    function pauseAll() external onlyOwner {
        if (address(dropClaim) != address(0)) dropClaim.pause();
        if (address(devcityToken) != address(0)) devcityToken.pause();
    }

    /**
     * @dev Unpause all contracts.
     */
    function unpauseAll() external onlyOwner {
        if (address(dropClaim) != address(0)) dropClaim.unpause();
        if (address(devcityToken) != address(0)) devcityToken.unpause();
    }

    /**
     * @dev Rescue tokens from deployer (if any sent by mistake).
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ========== Internal Helpers ==========

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
        (sqrtPriceX96, , , ) = IPoolManager(poolManager).getSlot0(poolId);
        if (sqrtPriceX96 == 0) {
            sqrtPriceX96 = SQRT_PRICE_1_1;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
