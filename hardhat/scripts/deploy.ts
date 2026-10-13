import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { CELO_SEPOLIA, MAX_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL } from "../config.js";
import { saveDeployments } from "../deployments.js";

async function main() {
  const [admin] = await ethers.getSigners();
  console.log("Admin wallet:", admin.address);

  const tokenURI = fs.readFileSync(path.join(__dirname, "tokenuri.txt"), "utf-8").trim();

  // 1. Deploy DEVCITY26Deployer implementation
  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployerImpl = await Deployer.deploy();
  await deployerImpl.waitForDeployment();
  const deployerImplAddr = await deployerImpl.getAddress();
  console.log("Deployer implementation:", deployerImplAddr);

  // 2. Deploy ERC1967Proxy with encoded initialize() calldata
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const initData = Deployer.interface.encodeFunctionData("initialize");
  const proxy = await Proxy.deploy(deployerImplAddr, initData);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("Deployer proxy:", proxyAddr);

  const deployer = Deployer.attach(proxyAddr);

  // 3. deployAll
  const deployAllTx = await deployer.deployAll(
    CELO_SEPOLIA.poolManager,
    CELO_SEPOLIA.positionManager,
    CELO_SEPOLIA.permit2,
    CELO_SEPOLIA.usdt,
    admin.address,
    MAX_SUPPLY,
    tokenURI
  );
  const receipt = await deployAllTx.wait();
  console.log("deployAll tx:", receipt.hash);

  // 4. Read child addresses
  const dropClaimAddr = await deployer.dropClaim();
  const factoryAddr = await deployer.profileTokenFactory();
  const tokenAddr = await deployer.devcityToken();

  saveDeployments({
    deployerProxy: proxyAddr,
    deployerImpl: deployerImplAddr,
    dropClaim: dropClaimAddr,
    profileTokenFactory: factoryAddr,
    devcityToken: tokenAddr,
  });

  // 5. Authorize admin as backend signer
  const signers = await deployer.getBackendSigners();
  if (!signers.includes(admin.address)) {
    const addTx = await deployer.addBackendSigner(admin.address);
    await addTx.wait();
    console.log("Added admin as backend signer:", admin.address);
  }
  console.log("Signers:", await deployer.getBackendSigners());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Deployer proxy:", proxyAddr);
  console.log("DropClaim:", dropClaimAddr);
  console.log("ProfileTokenFactory:", factoryAddr);
  console.log("DEVCITY26Token:", tokenAddr);
  console.log("Saved to hardhat/deployments.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
