// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title DropClaim
 * @dev Manages token drops with expiring signed authorizations and claim caps.
 * Designed for gas-sponsored claims via ERC-4337 bundlers and paymasters.
 */
contract DropClaim is EIP712, Ownable {
    using ECDSA for bytes32;

    // Drop structure
    struct Drop {
        address token;
        uint256 amountPerClaim;
        uint256 maxClaimants;
        uint256 currentClaimants;
        uint256 expiresAt;
        bool active;
        address creator;
    }

    bytes32 private constant CLAIM_AUTH_TYPEHASH =
        keccak256(
            "ClaimAuth(bytes32 dropId,address claimer,uint256 nonce,uint256 expiresAt)"
        );

    mapping(bytes32 => Drop) public drops;
    mapping(address => mapping(bytes32 => bool)) public hasClaimed;
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public budgetSpent;
    mapping(bytes32 => uint256) public budgetSpent_;

    uint256 public maxBudgetPerWallet = 1000 ether;
    uint256 public maxBudgetPerDrop = 10000 ether;

    address public signer;

    event DropCreated(
        bytes32 indexed dropId,
        address indexed token,
        uint256 amountPerClaim,
        uint256 maxClaimants,
        uint256 expiresAt
    );

    event DropClaimed(
        bytes32 indexed dropId,
        address indexed claimer,
        uint256 amount,
        uint256 timestamp
    );

    event DropClosed(bytes32 indexed dropId);
    event SignerUpdated(address newSigner);
    event BudgetUpdated(uint256 perWallet, uint256 perDrop);

    constructor(address _signer) EIP712("DEVCITY26", "1") Ownable(msg.sender) {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
    }

    /**
     * @dev Create a new drop.
     */
    function createDrop(
        bytes32 dropId,
        address token,
        uint256 amountPerClaim,
        uint256 maxClaimants,
        uint256 expiresAt
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amountPerClaim > 0, "Amount must be > 0");
        require(maxClaimants > 0, "Max claimants must be > 0");
        require(expiresAt > block.timestamp, "Expiry must be in future");
        require(!drops[dropId].active, "Drop already exists");

        drops[dropId] = Drop({
            token: token,
            amountPerClaim: amountPerClaim,
            maxClaimants: maxClaimants,
            currentClaimants: 0,
            expiresAt: expiresAt,
            active: true,
            creator: msg.sender
        });

        emit DropCreated(dropId, token, amountPerClaim, maxClaimants, expiresAt);
    }

    /**
     * @dev Claim tokens from a drop using a signed authorization.
     */
    function claim(
        bytes32 dropId,
        uint256 nonce,
        uint256 expiresAt,
        bytes calldata signature
    ) external {
        Drop storage drop = drops[dropId];

        require(drop.active, "Drop not active");
        require(block.timestamp < drop.expiresAt, "Drop expired");
        require(block.timestamp < expiresAt, "Authorization expired");
        require(drop.currentClaimants < drop.maxClaimants, "Drop full");
        require(!hasClaimed[msg.sender][dropId], "Already claimed");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_AUTH_TYPEHASH,
                    dropId,
                    msg.sender,
                    nonce,
                    expiresAt
                )
            )
        );
        require(digest.recover(signature) == signer, "Invalid signature");
        require(nonces[msg.sender] == nonce, "Invalid nonce");

        require(
            budgetSpent[msg.sender] + drop.amountPerClaim <= maxBudgetPerWallet,
            "Wallet budget exceeded"
        );
        require(
            budgetSpent_[dropId] + drop.amountPerClaim <= maxBudgetPerDrop,
            "Drop budget exceeded"
        );

        hasClaimed[msg.sender][dropId] = true;
        drop.currentClaimants += 1;
        nonces[msg.sender] += 1;
        budgetSpent[msg.sender] += drop.amountPerClaim;
        budgetSpent_[dropId] += drop.amountPerClaim;

        require(
            IERC20(drop.token).transfer(msg.sender, drop.amountPerClaim),
            "Transfer failed"
        );

        emit DropClaimed(dropId, msg.sender, drop.amountPerClaim, block.timestamp);
    }

    /**
     * @dev Close a drop.
     */
    function closeDrop(bytes32 dropId) external onlyOwner {
        require(drops[dropId].active, "Drop not active");
        drops[dropId].active = false;
        emit DropClosed(dropId);
    }

    /**
     * @dev Update the backend signer.
     */
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    /**
     * @dev Update sponsorship budgets.
     */
    function setBudgets(uint256 perWallet, uint256 perDrop) external onlyOwner {
        require(perWallet > 0 && perDrop > 0, "Budgets must be > 0");
        maxBudgetPerWallet = perWallet;
        maxBudgetPerDrop = perDrop;
        emit BudgetUpdated(perWallet, perDrop);
    }

    /**
     * @dev Withdraw unclaimed tokens from a drop.
     */
    function withdrawDrop(bytes32 dropId, address to) external onlyOwner {
        Drop storage drop = drops[dropId];
        require(!drop.active, "Drop must be closed first");

        uint256 remaining = IERC20(drop.token).balanceOf(address(this));
        require(remaining > 0, "No tokens to withdraw");
        require(IERC20(drop.token).transfer(to, remaining), "Transfer failed");
    }

    /**
     * @dev Get drop details.
     */
    function getDrop(bytes32 dropId)
        external
        view
        returns (
            address token,
            uint256 amountPerClaim,
            uint256 maxClaimants,
            uint256 currentClaimants,
            uint256 expiresAt,
            bool active
        )
    {
        Drop storage drop = drops[dropId];
        return (
            drop.token,
            drop.amountPerClaim,
            drop.maxClaimants,
            drop.currentClaimants,
            drop.expiresAt,
            drop.active
        );
    }

    /**
     * @dev Check if a user has claimed from a drop.
     */
    function hasUserClaimed(address user, bytes32 dropId)
        external
        view
        returns (bool)
    {
        return hasClaimed[user][dropId];
    }

    /**
     * @dev Get user's current nonce.
     */
    function getUserNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
}
