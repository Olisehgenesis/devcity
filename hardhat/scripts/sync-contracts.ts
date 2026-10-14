import { execSync } from "child_process";
import { existsSync } from "fs";

// Copy the canonical contracts from ../contracts into hardhat/contracts
const srcDir = "../contracts";
const files = [
  "DEVCITY26Deployer.sol",
  "DEVCITY26DeployerExtension.sol",
  "DEVCITY26Token.sol",
  "DropClaim.sol",
  "ProfileToken.sol",
  "ProfileTokenFactory.sol",
  "interfaces/IV4Core.sol",
];

for (const f of files) {
  if (!existsSync(`${srcDir}/${f}`)) {
    console.warn(`Skipping missing canonical source: ${srcDir}/${f}`);
    continue;
  }
  execSync(`cp "${srcDir}/${f}" "contracts/${f}"`, { stdio: "inherit" });
}
console.log("Synced contracts from ../contracts into hardhat/contracts");

// Also refresh the v4 library copy in node_modules
execSync(`cp ../contracts/v4lib/libraries/*.sol node_modules/@uniswap/v4-core/src/libraries/`, {
  stdio: "inherit",
});
console.log("Synced v4 libraries into node_modules/@uniswap/v4-core");
