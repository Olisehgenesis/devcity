// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CityToken
 * @dev ERC20 token with immutable max supply for DEVCITY26 events and creators.
 */
contract CityToken is ERC20, Ownable, Pausable {
    uint256 public immutable maxSupply;
    string public tokenURI;
    address public creator;
    uint256 public createdAt;

    event TokenURIUpdated(string newURI);

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 initialSupply,
        string memory _tokenURI,
        address _creator
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_maxSupply > 0, "Max supply must be > 0");
        require(initialSupply <= _maxSupply, "Initial supply exceeds max");
        require(_creator != address(0), "Invalid creator");

        maxSupply = _maxSupply;
        tokenURI = _tokenURI;
        creator = _creator;
        createdAt = block.timestamp;

        _mint(_creator, initialSupply);
    }

    /**
     * @dev Mint tokens, respecting the immutable max supply.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Update token metadata URI.
     */
    function setTokenURI(string memory _tokenURI) external onlyOwner {
        tokenURI = _tokenURI;
        emit TokenURIUpdated(_tokenURI);
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
}

/**
 * @title TokenFactory
 * @dev Factory for creating CityToken instances with immutable max supply.
 */
contract TokenFactory is Ownable {
    mapping(address => address[]) public creatorTokens;
    address[] public allTokens;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 initialSupply
    );

    /**
     * @dev Create a new CityToken.
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 initialSupply,
        string memory tokenURI
    ) external returns (address) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        require(maxSupply > 0, "Max supply must be > 0");
        require(initialSupply <= maxSupply, "Initial supply exceeds max");

        CityToken token = new CityToken(
            name,
            symbol,
            maxSupply,
            initialSupply,
            tokenURI,
            msg.sender
        );

        address tokenAddr = address(token);
        creatorTokens[msg.sender].push(tokenAddr);
        allTokens.push(tokenAddr);

        emit TokenCreated(
            tokenAddr,
            msg.sender,
            name,
            symbol,
            maxSupply,
            initialSupply
        );

        return tokenAddr;
    }

    /**
     * @dev Get all tokens created by a creator.
     */
    function getCreatorTokens(address creator)
        external
        view
        returns (address[] memory)
    {
        return creatorTokens[creator];
    }

    /**
     * @dev Get total number of tokens created.
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
}
