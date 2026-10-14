// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IProfileTokenFactoryAdmin {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function withdrawTreasuryTokens(address token, address recipient, uint256 amount) external;
}

/**
 * @dev Small UUPS extension for the existing deployer proxy. It forwards
 * legacy selectors to the current implementation while exposing the factory
 * admin routes needed for profile-token upgrades and treasury withdrawals.
 */
contract DEVCITY26DeployerExtension is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    address private immutable legacyImplementation;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _legacyImplementation) {
        require(_legacyImplementation != address(0), "Invalid legacy implementation");
        legacyImplementation = _legacyImplementation;
        _disableInitializers();
    }

    function upgradeProfileTokenFactory(address newImplementation) external onlyOwner {
        address factory = _profileTokenFactory();
        IProfileTokenFactoryAdmin(factory).upgradeToAndCall(newImplementation, "");
    }

    function withdrawProfileTokenTreasury(address token, address recipient, uint256 amount) external onlyOwner {
        address factory = _profileTokenFactory();
        IProfileTokenFactoryAdmin(factory).withdrawTreasuryTokens(token, recipient, amount);
    }

    function _profileTokenFactory() private view returns (address factory) {
        (bool success, bytes memory result) = address(this).staticcall(
            abi.encodeWithSignature("profileTokenFactory()")
        );
        require(success && result.length == 32, "Could not read profile-token factory");
        factory = abi.decode(result, (address));
        require(factory != address(0), "Factory not deployed");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    fallback() external payable {
        address implementation = legacyImplementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {
        revert("Direct CELO transfers are not supported");
    }
}
