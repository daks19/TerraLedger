const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying LandRegistry (minimal deployment)...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC\n");

  // Use previously deployed AccessControl or deploy minimal version
  const EXISTING_ACCESS_CONTROL = "0x1893191CA0cb3D97bc270d0D8b141BE514de7EDE";
  
  console.log("Using AccessControl at:", EXISTING_ACCESS_CONTROL);
  
  // Deploy LandRegistry
  console.log("\n📋 Deploying LandRegistry...");
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy(EXISTING_ACCESS_CONTROL);
  await landRegistry.waitForDeployment();
  const landRegistryAddress = await landRegistry.getAddress();
  console.log("✅ LandRegistry deployed to:", landRegistryAddress);

  console.log("\n-------------------------------------------");
  console.log("🎉 Deployment Complete!");
  console.log("-------------------------------------------");
  console.log("ACCESS_CONTROL_ADDRESS=" + EXISTING_ACCESS_CONTROL);
  console.log("LAND_REGISTRY_ADDRESS=" + landRegistryAddress);
  console.log("-------------------------------------------");
  console.log("\nAdd these to your backend .env file!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  });
