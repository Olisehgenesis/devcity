const fs = require("fs");
const path = require("path");

const CELO_SEPOLIA = {
  chainId: 11142220,
  rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
  poolManager: "0x2af85C83CFe7bC5182F81E5aE82661b4E9F15A1e",
  positionManager: "0xB104b7c42DAB49d31fe3Ea91Dd80305348Cc37C1",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  usdt: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
};

const MAX_SUPPLY = BigInt(1000000) * 10n ** 18n;
const TOKEN_NAME = "DEVCITY26";
const TOKEN_SYMBOL = "DEV26";

module.exports = { CELO_SEPOLIA, MAX_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL };
