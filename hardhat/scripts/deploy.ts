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

  // 2. Deploy ERC1967Proxy pointing at the implementation
  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await Proxy.deploy(deployerImplAddr, "0x");
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("Deployer proxy:", proxyAddr);

  // 3. Attach and initialize
  const deployer = Deployer.attach(proxyAddr);
  const initTx = await deployer.initialize();
  await initTx.wait();
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

  // Extract deployed contract addresses from event
  const iface = new ethers.Interface(Deployer.interface.format("full") as any);
  let dropClaimAddr, factoryAddr, tokenAddr;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === "ContractsDeployed") {
        dropClaimAddr = parsed.args.dropClaim;
        factoryAddr = parsed.args.profileTokenFactory;
        tokenAddr = parsed.args.devcityToken;
      }
    } catch {}
  }
  console.log("DropClaim:", dropClaimAddr);
  console.log("ProfileTokenFactory:", factoryAddr);
  console.log("DEVCITY26Token:", tokenAddr);

  // 5. Authorize backend signer (admin wallet) on DropClaim
  if (dropClaimAddr) {
    const DropClaim = await ethers.getContractFactory("DropClaim");
    const dropClaim = DropClaim.attach(dropClaimAddr);
    const existing = await dropClaim.getSigners();
    if (!existing.includes(admin.address)) {
      const addTx = await dropClaim.addSigner(admin.address);
      await addTx.wait();
      console.log("Added admin as backend signer");
    }
    console.log("Signers:", await dropClaim.getSigners());
  }

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
