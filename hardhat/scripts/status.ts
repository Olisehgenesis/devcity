import { ethers } from "hardhat";
import { requireDeployments } from "../deployments.js";

async function main() {
  const [admin] = await ethers.getSigners();
  const d = requireDeployments();
  console.log("Using deployments:", d.deployerProxy);

  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployer = Deployer.attach(d.deployerProxy);

  const Token = await ethers.getContractFactory("DEVCITY26Token");
  const token = Token.attach(d.devcityToken);

  console.log("Token name:", await token.name());
  console.log("Symbol:", await token.symbol());
  console.log("MAX_SUPPLY:", (await token.MAX_SUPPLY()).toString());
  console.log("totalSupply:", (await token.totalSupply()).toString());
  console.log("tokenURI:", (await token.tokenURI()));
  console.log("PoolManager:", await token.poolManager());
  console.log("USDT:", await token.usdtToken());
  console.log("Backend signers:", await deployer.getBackendSigners());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
