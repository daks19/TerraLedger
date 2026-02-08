const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying TerraLedgerRegistry (simple version)...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC\n");

  // Deploy simple registry
  console.log("📋 Deploying TerraLedgerRegistry...");
  const Registry = await ethers.getContractFactory("TerraLedgerRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ TerraLedgerRegistry deployed to:", registryAddress);

  // Verify it works - register a test parcel
  console.log("\n📝 Testing: Registering a demo parcel on-chain...");
  const testParcelId = "TL-DEMO-001";
  const testDataHash = ethers.keccak256(ethers.toUtf8Bytes("demo parcel data"));
  const tx = await registry.registerParcel(testParcelId, testDataHash);
  await tx.wait();
  console.log("✅ Demo parcel registered! TxHash:", tx.hash);

  // Verify
  const parcel = await registry.getParcel(testParcelId);
  console.log("✅ Verified on-chain:", parcel.exists ? "YES" : "NO");

  console.log("\n-------------------------------------------");
  console.log("🎉 Deployment Complete!");
  console.log("-------------------------------------------");
  console.log("TERRA_REGISTRY_ADDRESS=" + registryAddress);
  console.log("-------------------------------------------");
  console.log("\nAdd this to your backend .env file:");
  console.log(`LAND_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`POLYGON_RPC_URL=https://rpc-amoy.polygon.technology/`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  });
