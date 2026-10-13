import { ethers } from "hardhat";
import { requireDeployments } from "../deployments.js";

async function main() {
  const [admin] = await ethers.getSigners();
  const signerArg = process.env.SIGNER || process.env.SIGNER_ADDRESS;
  if (!signerArg) {
    throw new Error("Pass the signer address via SIGNER=0x... npm run remove-signer");
  }
  const d = requireDeployments();
  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployer = Deployer.attach(d.deployerProxy);
  console.log("Removing signer:", signerArg, "as", admin.address);
  const tx = await deployer.removeBackendSigner(signerArg);
  await tx.wait();
  console.log("Removed. tx:", tx.hash);
  console.log("Signers:", await deployer.getBackendSigners());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
