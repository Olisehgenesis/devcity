import { ethers } from "hardhat";
import { saveDeployments } from "../deployments.js";

async function main() {
  const deployerProxyAddress = process.env.DEVCITY_DEPLOYER_PROXY;
  if (!deployerProxyAddress) {
    throw new Error("Set DEVCITY_DEPLOYER_PROXY to the existing Celo Sepolia deployer proxy.");
  }

  const [admin] = await ethers.getSigners();
  const deployer = await ethers.getContractAt("DEVCITY26Deployer", deployerProxyAddress, admin);
  const owner = await deployer.owner();
  if (owner.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`Configured signer ${admin.address} is not the deployer owner ${owner}.`);
  }

  const factoryProxyAddress = await deployer.profileTokenFactory();
  const factoryBefore = await ethers.getContractAt("ProfileTokenFactory", factoryProxyAddress, admin);
  const factoryOwner = await factoryBefore.owner();
  if (factoryOwner.toLowerCase() !== deployerProxyAddress.toLowerCase()) {
    throw new Error(`Factory owner ${factoryOwner} is not the deployer proxy ${deployerProxyAddress}.`);
  }

  try {
    if (await factoryBefore.supportsPriceAwarePoolLaunch()) {
      console.log("Profile-token factory already supports price-aware launches; no transactions sent.");
      return;
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "CALL_EXCEPTION") throw error;
  }

  const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const currentImplementationWord = await ethers.provider.getStorage(deployerProxyAddress, implementationSlot);
  const currentImplementation = ethers.getAddress(`0x${currentImplementationWord.slice(-40)}`);
  if (currentImplementation === ethers.ZeroAddress) {
    throw new Error("Could not read the current deployer implementation from its proxy.");
  }

  const DeployerExtension = await ethers.getContractFactory("DEVCITY26DeployerExtension", admin);
  const deployerImplementation = await DeployerExtension.deploy(currentImplementation);
  await deployerImplementation.waitForDeployment();

  const ProfileFactoryImplementation = await ethers.getContractFactory("ProfileTokenFactory", admin);
  const profileFactoryImplementation = await ProfileFactoryImplementation.deploy();
  await profileFactoryImplementation.waitForDeployment();

  await deployer.upgradeToAndCall.staticCall(await deployerImplementation.getAddress(), "0x");
  const deployerUpgrade = await deployer.upgradeToAndCall(await deployerImplementation.getAddress(), "0x");
  await deployerUpgrade.wait();

  const upgradedDeployer = await ethers.getContractAt("DEVCITY26DeployerExtension", deployerProxyAddress, admin);
  await upgradedDeployer.upgradeProfileTokenFactory.staticCall(await profileFactoryImplementation.getAddress());
  const factoryUpgrade = await upgradedDeployer.upgradeProfileTokenFactory(await profileFactoryImplementation.getAddress());
  await factoryUpgrade.wait();

  const upgradedFactory = await ethers.getContractAt("ProfileTokenFactory", factoryProxyAddress, admin);
  let priceAware = false;
  let capabilityReadError: unknown;
  for (let attempt = 0; attempt < 4 && !priceAware; attempt += 1) {
    try {
      priceAware = await upgradedFactory.supportsPriceAwarePoolLaunch();
    } catch (error) {
      capabilityReadError = error;
    }
    if (!priceAware && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  if (!priceAware) {
    if (capabilityReadError) {
      const detail = capabilityReadError instanceof Error ? capabilityReadError.message : String(capabilityReadError);
      throw new Error(`Factory upgrade transactions completed, but the capability check failed after retries: ${detail}`);
    }
    throw new Error("Profile-token factory upgrade completed but the price-aware launch check failed.");
  }

  saveDeployments({
    deployerProxy: deployerProxyAddress,
    deployerImpl: await deployerImplementation.getAddress(),
    deployerLegacyImpl: currentImplementation,
    profileTokenFactory: factoryProxyAddress,
    profileTokenFactoryImpl: await profileFactoryImplementation.getAddress(),
  });

  console.log("Deployer implementation:", await deployerImplementation.getAddress());
  console.log("ProfileTokenFactory implementation:", await profileFactoryImplementation.getAddress());
  console.log("ProfileTokenFactory proxy:", factoryProxyAddress);
  console.log("Legacy deployer forwarding: enabled");
  console.log("Price-aware pool launch: enabled");
  console.log("Treasury allocation: 10% held by factory; 90% minted to token owner");
  console.log("New profile-token buy/sell: enabled without protocol trade tax");
  console.log("Updated local deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
