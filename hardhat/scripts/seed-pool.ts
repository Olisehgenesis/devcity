import { ethers } from "hardhat";
import { requireDeployments } from "../deployments.js";

async function main() {
  const [admin] = await ethers.getSigners();
  const d = requireDeployments();
  const Deployer = await ethers.getContractFactory("DEVCITY26Deployer");
  const deployer = Deployer.attach(d.deployerProxy);

  // Optional overrides from env
  const amount0 = process.env.AMOUNT0 ? BigInt(process.env.AMOUNT0) : ethers.parseEther("1000");
  const amount1 = process.env.AMOUNT1 ? BigInt(process.env.AMOUNT1) : ethers.parseUnits("1000", 6);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  console.log("Seeding DEVCITY26/USDT pool (full range)");
  console.log("  token0 amount:", amount0.toString(), "| token1 amount:", amount1.toString());

  const tx = await deployer.createDevcityPool(amount0, amount1, 0, 0, deadline);
  const receipt = await tx.wait();
  console.log("Pool created. tx:", receipt.hash);

  const Token = await ethers.getContractFactory("DEVCITY26Token");
  const token = Token.attach(d.devcityToken);
  console.log("poolId:", await token.poolId());
  console.log("poolCreated:", await token.poolCreated());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
