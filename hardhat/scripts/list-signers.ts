import { ethers } from "hardhat";
import { requireDeployments } from "../deployments.js";

async function main() {
  const [admin] = await ethers.getSigners();
  const d = requireDeployments();
  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployer = Deployer.attach(d.deployerProxy);

  const signers = await deployer.getBackendSigners();
  console.log("Current backend signers:", signers);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
