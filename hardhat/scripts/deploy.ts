import { ethers } from "hardhat";

const ZERO = "0x0000000000000000000000000000000000000000";

const CELO_SEPOLIA = {
  poolManager: "0x2af85C83CFe7bC5182F81E5aE82661b4E9F15A1e",
  positionManager: "0xB104b7c42DAB49d31fe3Ea91Dd80305348Cc37C1",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  usdt: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
};

const MAX_SUPPLY = BigInt(1000000) * 10n ** 18n;
const TOKEN_URI = "data:application/json;base64,eyJuYW1lIjogIkRFVkNJVFkyNiIsICJzeW1ib2wiOiAiREVWMjY";

// Read token URI from file generated during build
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [admin] = await ethers.getSigners();
  console.log("Admin wallet:", admin.address);

  const fileTokenUri = fs.readFileSync(path.join(__dirname, "..", "tokenuri.txt"), "utf-8").trim();
  const tokenURI = fileTokenUri || TOKEN_URI;

  // 1. Deploy DEVCITY26Deployer implementation
  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployerImpl = await Deployer.deploy();
  await deployerImpl.waitForDeployment();
  const deployerImplAddr = await deployerImpl.getAddress();
  console.log("Deployer implementation:", deployerImplAddr);

  // 2. Deploy ERC1967Proxy pointing at the implementation, with encoded initialize() calldata
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const initData = Deployer.interface.encodeFunctionData("initialize");
  const proxy = await Proxy.deploy(deployerImplAddr, initData);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("Deployer proxy:", proxyAddr);

  // 3. Attach (already initialized via constructor data)
  const deployer = Deployer.attach(proxyAddr);
  console.log("Initialized");

  // 4. deployAll
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

  // Read deployed child contract addresses from public getters
  const dropClaimAddr = await deployer.dropClaim();
  const factoryAddr = await deployer.profileTokenFactory();
  const tokenAddr = await deployer.devcityToken();
  console.log("DropClaim:", dropClaimAddr);
  console.log("ProfileTokenFactory:", factoryAddr);
  console.log("DEVCITY26Token:", tokenAddr);

  // 5. Authorize backend signer (admin wallet) on DropClaim via the deployer
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
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
