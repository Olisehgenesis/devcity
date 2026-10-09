// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimplePaymaster
 * @dev Basic paymaster for sponsoring gas on Base Sepolia.
 * In production, use a maintained bundler/paymaster service (e.g., Pimlico, Alchemy).
 */
contract SimplePaymaster is Ownable {
    mapping(address => bool) public sponsoredOps;
    uint256 public totalSponsored;
    uint256 public maxSponsorPerOp = 0.01 ether;

    event OperationSponsored(address indexed user, uint256 gasUsed);
    event MaxSponsorUpdated(uint256 newMax);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Receive ETH for sponsoring operations.
     */
    receive() external payable {}

    /**
     * @dev Sponsor an operation (called by bundler).
     */
    function sponsorOperation(address user, uint256 gasUsed) external onlyOwner {
        require(gasUsed <= maxSponsorPerOp, "Gas cost exceeds limit");
        require(address(this).balance >= gasUsed, "Insufficient balance");

        sponsoredOps[user] = true;
        totalSponsored += gasUsed;

        emit OperationSponsored(user, gasUsed);
    }

    /**
     * @dev Update max sponsor per operation.
     */
    function setMaxSponsor(uint256 newMax) external onlyOwner {
        maxSponsorPerOp = newMax;
        emit MaxSponsorUpdated(newMax);
    }

    /**
     * @dev Withdraw remaining balance.
     */
    function withdraw(address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        to.transfer(address(this).balance);
    }

    /**
     * @dev Get contract balance.
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
