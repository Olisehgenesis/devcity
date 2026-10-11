// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DropClaim
 * @dev Manages token drops with expiring signed authorizations and claim caps.
 * Backend signs ClaimAuthorization, wallet (or relayer) submits claim with own gas.
 * UUPS upgradeable.
 */
contract DropClaim is
    Initializable,
    EIP712Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    struct Drop {
        address token;
        uint256 totalAmount;
        uint256 amountPerClaim;
        uint256 maxClaimants;
        uint256 currentClaimants;
        uint256 startTime;
        uint256 endTime;
        address claimAuthority;
        bool active;
        bool exists;
        bytes32 eventId;
        bytes32 placeId;
        address creator;
    }

    bytes32 private constant CLAIM_AUTH_TYPEHASH =
        keccak256(
            "ClaimAuthorization(bytes32 dropId,address claimant,uint256 amount,uint256 nonce,uint256 deadline)"
        );

    mapping(bytes32 => Drop) public drops;
    mapping(address => mapping(bytes32 => bool)) public hasClaimed;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => uint256) public dropClaimedAmount;

    // Backend signers authorized to authorize claims. Managed by the owner (admin).
    mapping(address => bool) public authorizedSigners;
    address[] public signerList;

    event DropCreated(
        bytes32 indexed dropId,
        address indexed token,
        uint256 totalAmount,
        uint256 amountPerClaim,
        uint256 maxClaimants,
        uint256 startTime,
        uint256 endTime,
        address claimAuthority,
        bytes32 eventId,
        bytes32 placeId,
        address creator
    );

    event TokensClaimed(
        bytes32 indexed dropId,
        address indexed claimant,
        uint256 amount
    );

    event DropClosed(bytes32 indexed dropId);

    event Withdrawn(
        bytes32 indexed dropId,
        address indexed recipient,
        uint256 amount
    );

    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __EIP712_init("DEVCITY26", "1");
        __Ownable_init(msg.sender);
        __Pausable_init();
    }

    /**
     * @dev Create a new drop. Pulls totalAmount of tokens from creator at creation.
     * @param dropId Unique identifier for the drop
     * @param token ERC20 token address
     * @param totalAmount Total tokens to fund this drop (must be >= amountPerClaim * maxClaimants)
     * @param amountPerClaim Tokens per claim
     * @param maxClaimants Maximum number of claimants
     * @param startTime Drop start timestamp
     * @param endTime Drop end timestamp
     * @param claimAuthority Address authorized to sign claims (typically backend signer)
     * @param eventId Optional event identifier for grouping
     * @param placeId Optional place identifier for geofencing
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
    ) external {
        require(token != address(0), "Invalid token");
        require(totalAmount > 0, "Total amount must be > 0");
        require(amountPerClaim > 0, "Amount per claim must be > 0");
        require(maxClaimants > 0, "Max claimants must be > 0");
        require(totalAmount >= amountPerClaim * maxClaimants, "Insufficient total amount");
        require(startTime < endTime, "Invalid time range");
        require(endTime > block.timestamp, "End time must be in future");
        require(claimAuthority != address(0), "Invalid claim authority");
        require(authorizedSigners[claimAuthority], "Signer not authorized");
        require(!drops[dropId].exists, "Drop already exists");

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        drops[dropId] = Drop({
            token: token,
            totalAmount: totalAmount,
            amountPerClaim: amountPerClaim,
            maxClaimants: maxClaimants,
            currentClaimants: 0,
            startTime: startTime,
            endTime: endTime,
            claimAuthority: claimAuthority,
            active: true,
            exists: true,
            eventId: eventId,
            placeId: placeId,
            creator: msg.sender
        });

        emit DropCreated(
            dropId, token, totalAmount, amountPerClaim, maxClaimants,
            startTime, endTime, claimAuthority, eventId, placeId, msg.sender
        );
    }

    /**
     * @dev Add a backend signer to the authorized list (owner only).
     */
    function addSigner(address signer) external onlyOwner {
        require(signer != address(0), "Invalid signer");
        require(!authorizedSigners[signer], "Already authorized");
        authorizedSigners[signer] = true;
        signerList.push(signer);
        emit SignerAdded(signer);
    }

    /**
     * @dev Remove a backend signer from the authorized list (owner only).
     */
    function removeSigner(address signer) external onlyOwner {
        require(authorizedSigners[signer], "Not an authorized signer");
        authorizedSigners[signer] = false;
        for (uint256 i = 0; i < signerList.length; i++) {
            if (signerList[i] == signer) {
                signerList[i] = signerList[signerList.length - 1];
                signerList.pop();
                break;
            }
        }
        emit SignerRemoved(signer);
    }

    /**
     * @dev Get the current list of authorized backend signers.
     */
    function getSigners() external view returns (address[] memory) {
        return signerList;
    }

    /**
     * @dev Claim tokens from a drop using a signed authorization.
     * Can be called by claimant directly or by a relayer on their behalf.
     * @param dropId Drop identifier
     * @param claimant Address receiving the tokens
     * @param amount Amount to claim (must match drop's amountPerClaim)
     * @param nonce Claimant's current nonce
     * @param deadline Authorization expiry timestamp
     * @param signature Signature from claimAuthority over ClaimAuthorization
     */
    function claim(
        bytes32 dropId,
        address claimant,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Drop storage drop = drops[dropId];

        require(drop.exists, "Drop does not exist");
        require(drop.active, "Drop not active");
        require(block.timestamp >= drop.startTime, "Drop not started");
        require(block.timestamp < drop.endTime, "Drop expired");
        require(deadline >= block.timestamp, "Authorization expired");
        require(drop.currentClaimants < drop.maxClaimants, "Drop full");
        require(!hasClaimed[claimant][dropId], "Already claimed");
        require(amount == drop.amountPerClaim, "Invalid amount");
        require(claimant != address(0), "Invalid claimant");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_AUTH_TYPEHASH,
                    dropId,
                    claimant,
                    amount,
                    nonce,
                    deadline
                )
            )
        );
        require(digest.recover(signature) == drop.claimAuthority, "Invalid signature");
        require(nonces[claimant] == nonce, "Invalid nonce");

        hasClaimed[claimant][dropId] = true;
        drop.currentClaimants += 1;
        nonces[claimant] += 1;
        dropClaimedAmount[dropId] += amount;

        IERC20(drop.token).safeTransfer(claimant, amount);

        emit TokensClaimed(dropId, claimant, amount);
    }

    /**
     * @dev Close a drop early (owner only).
     */
    function closeDrop(bytes32 dropId) external onlyOwner {
        require(drops[dropId].exists, "Drop does not exist");
        require(drops[dropId].active, "Drop not active");
        drops[dropId].active = false;
        emit DropClosed(dropId);
    }

    /**
     * @dev Permissionless withdrawal of unclaimed tokens after drop expiry.
     * Funds are sent to the drop creator.
     */
    function withdrawExpired(bytes32 dropId) external {
        Drop storage drop = drops[dropId];
        require(drop.exists, "Drop does not exist");
        require(!drop.active, "Drop still active");
        require(block.timestamp >= drop.endTime, "Drop not expired");

        uint256 claimed = dropClaimedAmount[dropId];
        uint256 remaining = drop.totalAmount - claimed;
        require(remaining > 0, "Nothing to withdraw");

        IERC20(drop.token).safeTransfer(drop.creator, remaining);

        emit Withdrawn(dropId, drop.creator, remaining);
    }

    /**
     * @dev Owner withdraw of unclaimed tokens (after close or expiry).
     */
    function withdrawDrop(bytes32 dropId, address to) external onlyOwner {
        Drop storage drop = drops[dropId];
        require(drop.exists, "Drop does not exist");
        require(!drop.active, "Drop must be closed first");

        uint256 claimed = dropClaimedAmount[dropId];
        uint256 remaining = drop.totalAmount - claimed;
        require(remaining > 0, "No tokens to withdraw");

        IERC20(drop.token).safeTransfer(to, remaining);

        emit Withdrawn(dropId, to, remaining);
    }

    /**
     * @dev Get drop details.
     */
    function getDrop(bytes32 dropId)
        external
        view
        returns (
            address token,
            uint256 totalAmount,
            uint256 amountPerClaim,
            uint256 maxClaimants,
            uint256 currentClaimants,
            uint256 startTime,
            uint256 endTime,
            address claimAuthority,
            bool isActive
        )
    {
        Drop storage drop = drops[dropId];
        return (
            drop.token,
            drop.totalAmount,
            drop.amountPerClaim,
            drop.maxClaimants,
            drop.currentClaimants,
            drop.startTime,
            drop.endTime,
            drop.claimAuthority,
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

    /**
     * @dev Get drop event ID.
     */
    function getDropEventId(bytes32 dropId) external view returns (bytes32) {
        return drops[dropId].eventId;
    }

    /**
     * @dev Get drop place ID.
     */
    function getDropPlaceId(bytes32 dropId) external view returns (bytes32) {
        return drops[dropId].placeId;
    }

    /**
     * @dev Global pause (emergency stop).
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
