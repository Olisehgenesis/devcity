// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IV4Core.sol";

/**
 * @title ProfileToken
 * @dev User's personal profile token (one per user), UUPS upgradeable.
 * Max supply 1,000,000. Can be paired with USDT on Uniswap V4.
 * Supports: tipping (transfer), pay/burn-to-USDT via V4, adding liquidity.
 */
contract ProfileToken is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IUnlockCallback
{
    using SafeERC20 for IERC20;
    using BalanceDeltaLib for BalanceDelta;

    uint256 public MAX_SUPPLY;
    uint256 public constant TREASURY_BPS = 1_000;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    string public tokenURI;
    address public profileOwner;
    uint256 public createdAt;
    address public usdtToken;
    address public factory;

    // Uniswap V4 pool reference
    IPoolManager public poolManager;
    IPositionManager public positionManager;
    IPermit2 public permit2;
    bytes32 public poolId;
    bool public poolCreated;
    bytes32 private activeSwapDataHash;

    event TokenURIUpdated(string newURI);
    event PoolCreated(bytes32 indexed poolId);
    event USDTTokenSet(address usdtToken);
    event TokensBurnedForUSDT(uint256 amount, uint256 usdtReceived);
    event TokensSoldForUSDT(address indexed seller, uint256 tokenAmount, uint256 usdtReceived);
    event TokensBoughtWithUSDT(address indexed buyer, uint256 usdtAmount, uint256 tokenReceived);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the profile token. The factory is the initial owner so it
     * can wire up V4 contracts and mark the pool created; ownership is then
     * transferred to the profile owner by the factory.
     */
    function initialize(
        string memory name,
        string memory symbol,
        string memory _tokenURI,
        address _profileOwner,
        address _usdtToken,
        address _factory
    ) external initializer {
        require(_profileOwner != address(0), "Invalid profile owner");
        require(_usdtToken != address(0), "Invalid USDT token");
        require(_factory != address(0), "Invalid factory");

        __ERC20_init(name, symbol);
        __Ownable_init(_factory);
        __Pausable_init();

        MAX_SUPPLY = 1_000_000 * 10**18;
        tokenURI = _tokenURI;
        profileOwner = _profileOwner;
        createdAt = block.timestamp;
        usdtToken = _usdtToken;
        factory = _factory;

        uint256 treasuryAllocation = (MAX_SUPPLY * TREASURY_BPS) / BPS_DENOMINATOR;
        _mint(_profileOwner, MAX_SUPPLY - treasuryAllocation);
        _mint(_factory, treasuryAllocation);
    }

    /**
     * @dev Restrict to factory or owner.
     */
    modifier onlyFactoryOrOwner() {
        require(msg.sender == factory || msg.sender == owner(), "Not factory or owner");
        _;
    }

    /**
     * @dev Update token metadata URI.
     */
    function setTokenURI(string memory _tokenURI) external onlyOwner {
        tokenURI = _tokenURI;
        emit TokenURIUpdated(_tokenURI);
    }

    /**
     * @dev Set Uniswap V4 contracts (owner only, once).
     */
    function setV4Contracts(
        address _poolManager,
        address _positionManager,
        address _permit2
    ) external onlyFactoryOrOwner {
        require(address(poolManager) == address(0), "Already set");
        require(_poolManager != address(0), "Invalid PoolManager");
        require(_positionManager != address(0), "Invalid PositionManager");
        require(_permit2 != address(0), "Invalid Permit2");

        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        permit2 = IPermit2(_permit2);
    }

    /**
     * @dev Set USDT token address (only before pool creation).
     */
    function setUSDTToken(address _usdtToken) external onlyOwner {
        require(!poolCreated, "Cannot change after pool created");
        require(_usdtToken != address(0), "Invalid USDT token");
        usdtToken = _usdtToken;
        emit USDTTokenSet(_usdtToken);
    }

    /**
     * @dev Swap tokens for USDT via Uniswap V4 unlock/settle pattern.
     * Tokens are transferred to the PoolManager for settlement, not burned.
     * @param amountIn Token amount to swap
     * @param minUSDTOut Minimum USDT to receive (slippage protection)
     * @param deadline Swap deadline
     * @return usdtReceived Actual USDT received
     */
    function burnForUSDT(
        uint256 amountIn,
        uint256 minUSDTOut,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 usdtReceived) {
        return _sellForUSDT(amountIn, minUSDTOut, deadline);
    }

    function sellForUSDT(
        uint256 amountIn,
        uint256 minUSDTOut,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 usdtReceived) {
        return _sellForUSDT(amountIn, minUSDTOut, deadline);
    }

    function _sellForUSDT(
        uint256 amountIn,
        uint256 minUSDTOut,
        uint256 deadline
    ) internal returns (uint256 usdtReceived) {
        require(poolCreated, "Pool not created");
        require(amountIn > 0, "Amount must be > 0");
        require(block.timestamp <= deadline, "Deadline passed");
        require(address(poolManager) != address(0), "PoolManager not set");
        require(usdtToken != address(0), "USDT not set");

        bool zeroForOne = address(this) < usdtToken;
        _transfer(msg.sender, address(this), amountIn);
        usdtReceived = _swapExactInput(amountIn, minUSDTOut, msg.sender, address(this), usdtToken, zeroForOne);
        emit TokensBurnedForUSDT(amountIn, usdtReceived);
        emit TokensSoldForUSDT(msg.sender, amountIn, usdtReceived);
    }

    function buyWithUSDT(
        uint256 usdtAmountIn,
        uint256 minTokensOut,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 tokensReceived) {
        require(poolCreated, "Pool not created");
        require(usdtAmountIn > 0, "Amount must be > 0");
        require(block.timestamp <= deadline, "Deadline passed");
        require(address(poolManager) != address(0), "PoolManager not set");
        require(usdtToken != address(0), "USDT not set");

        IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), usdtAmountIn);
        bool zeroForOne = usdtToken < address(this);
        tokensReceived = _swapExactInput(usdtAmountIn, minTokensOut, msg.sender, usdtToken, address(this), zeroForOne);
        emit TokensBoughtWithUSDT(msg.sender, usdtAmountIn, tokensReceived);
    }

    function _swapExactInput(
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address inputToken,
        address outputToken,
        bool zeroForOne
    ) internal returns (uint256 amountOut) {
        require(amountIn <= uint256(type(int256).max), "Amount too large");
        bytes memory callbackData = abi.encode(
            SwapCallbackData({
                amountIn: amountIn,
                minAmountOut: minAmountOut,
                recipient: recipient,
                inputToken: inputToken,
                outputToken: outputToken,
                zeroForOne: zeroForOne
            })
        );
        activeSwapDataHash = keccak256(callbackData);
        bytes memory result = poolManager.unlock(callbackData);
        require(activeSwapDataHash == bytes32(0), "Swap callback not completed");
        BalanceDelta delta = BalanceDelta.wrap(abi.decode(result, (int256)));
        int256 outDelta = zeroForOne ? delta.amount1() : delta.amount0();
        require(outDelta > 0, "No output received");
        amountOut = uint256(outDelta);
        require(amountOut >= minAmountOut, "Slippage exceeded");
    }

    /**
     * @dev Tip tokens to another address (plain transfer).
     */
    function tip(address to, uint256 amount) external whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        _transfer(msg.sender, to, amount);
    }

    /**
     * @dev Burn tokens (reduce supply) without swap.
     */
    function burn(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
    }

    /**
     * @dev Pause/unpause transfers.
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
    }

    /**
     * @dev Set pool created flag and pool ID (called by factory after pool creation).
     */
    function setPoolCreated(bytes32 _poolId) external onlyFactoryOrOwner {
        require(!poolCreated, "Pool already created");
        poolId = _poolId;
        poolCreated = true;
        emit PoolCreated(_poolId);
    }

    // ========== V4 Unlock Callback Implementation ==========

    struct SwapCallbackData {
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        address inputToken;
        address outputToken;
        bool zeroForOne;
    }

    /**
     * @dev V4 unlock callback - executes the swap and handles settlement.
     * Only the PoolManager may call this.
     */
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");
        require(activeSwapDataHash != bytes32(0) && keccak256(data) == activeSwapDataHash, "Unexpected callback");
        activeSwapDataHash = bytes32(0);
        SwapCallbackData memory params = abi.decode(data, (SwapCallbackData));

        bool zeroForOne = params.zeroForOne;
        require(
            (params.inputToken == address(this) && params.outputToken == usdtToken)
                || (params.inputToken == usdtToken && params.outputToken == address(this)),
            "Unsupported pair"
        );
        require(zeroForOne == (params.inputToken < params.outputToken), "Invalid swap direction");

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(zeroForOne ? params.inputToken : params.outputToken),
            currency1: Currency.wrap(zeroForOne ? params.outputToken : params.inputToken),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });

        poolManager.sync(Currency.wrap(params.inputToken));
        BalanceDelta swapDelta = poolManager.swap(
            poolKey,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(params.amountIn),
                sqrtPriceLimitX96: zeroForOne
                    ? 4295128740
                    : 1461446703485210103287273052203988822378723970341
            }),
            ""
        );

        int256 inDelta = zeroForOne ? swapDelta.amount0() : swapDelta.amount1();
        require(inDelta < 0, "No input consumed");
        uint256 amountConsumed = uint256(-inDelta);
        require(amountConsumed <= params.amountIn, "Input exceeded");
        IERC20(params.inputToken).safeTransfer(address(poolManager), amountConsumed);
        poolManager.settle();

        int256 outDelta = zeroForOne ? swapDelta.amount1() : swapDelta.amount0();
        require(outDelta > 0, "No output received");
        uint256 amountOut = uint256(outDelta);
        uint256 refund = params.amountIn - amountConsumed;
        if (refund > 0) IERC20(params.inputToken).safeTransfer(params.recipient, refund);
        poolManager.take(Currency.wrap(params.outputToken), params.recipient, amountOut);

        require(amountOut >= params.minAmountOut, "Slippage exceeded");

        return abi.encode(swapDelta);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
