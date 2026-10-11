// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Minimal, ABI-correct Uniswap V4 interfaces matching v4-core/v4-periphery.
// These types/structs encode identically to the real V4 contracts.

type Currency is address;
type PoolId is bytes32;
type BalanceDelta is int256;

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}

interface IPoolManager {
    function unlock(bytes calldata data) external returns (bytes memory);
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external
        returns (BalanceDelta swapDelta);
    function sync(Currency currency) external;
    function take(Currency currency, address to, uint256 amount) external;
    function settle() external payable returns (uint256 paid);
    function getSlot0(PoolId id) external view returns (uint160 sqrtPriceX96, int24 tick, uint16 protocolFee, uint8 tickSpacing);
}

interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

interface IPermit2 {
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

// Action constants matching v4-periphery libraries/Actions.sol
library Actions {
    uint256 internal constant INCREASE_LIQUIDITY = 0x00;
    uint256 internal constant DECREASE_LIQUIDITY = 0x01;
    uint256 internal constant MINT_POSITION = 0x02;
    uint256 internal constant BURN_POSITION = 0x03;
    uint256 internal constant SETTLE_PAIR = 0x0d;
    uint256 internal constant TAKE_PAIR = 0x11;
}

// Action constants matching v4-periphery libraries/ActionConstants.sol
library ActionConstants {
    address internal constant MSG_SENDER = address(1);
    address internal constant ADDRESS_THIS = address(2);
}

// Helpers for the user-defined value types
library BalanceDeltaLib {
    /// @notice amount0 is the upper 128 bits
    function amount0(BalanceDelta self) internal pure returns (int256) {
        return int256(int128(int256(BalanceDelta.unwrap(self)) >> 128));
    }

    /// @notice amount1 is the lower 128 bits
    function amount1(BalanceDelta self) internal pure returns (int256) {
        return int256(int128(int256(BalanceDelta.unwrap(self))));
    }
}

library CurrencyLib {
    function wrap(address a) internal pure returns (Currency) {
        return Currency.wrap(a);
    }
    function unwrap(Currency c) internal pure returns (address) {
        return Currency.unwrap(c);
    }
}
