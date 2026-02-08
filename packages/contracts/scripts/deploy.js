const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Timeout wrapper for waitForDeployment to prevent infinite hangs
async function waitForDeploymentWithTimeout(contract, timeoutMs = 300000) {
  return Promise.race([
    contract.waitForDeployment(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Deployment timeout after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function deployWithRetry(factoryName, args, label, retries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const Factory = await ethers.getContractFactory(factoryName);
      const contract = await Factory.deploy(...args);
      const deploymentTx = contract.deploymentTransaction();
      const txHash = deploymentTx?.hash;
      if (txHash) {
        console.log(`   Tx hash: ${txHash}`);
        console.log(`   Waiting for confirmation (up to 5 min)... (${label}, attempt ${attempt}/${retries})`);
        await waitForDeploymentWithTimeout(contract, 300000);
      } else {
        console.log(`   Tx sent. Waiting for confirmation (up to 5 min)... (${label}, attempt ${attempt}/${retries})`);
        await waitForDeploymentWithTimeout(contract, 300000);
      }
      return contract;
    } catch (error) {
      const message = typeof error?.message === "string" ? error.message : String(error);
      const isLast = attempt === retries;
      if (isLast) {
        throw error;
      }
      console.log(`⚠️  ${label} failed (attempt ${attempt}/${retries}): ${message}`);
      console.log(`   Retrying in ${Math.ceil(delayMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  console.log("🚀 Starting TerraLedger Contract Deployment...\n");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const feeData = await ethers.provider.getFeeData();
  console.log("Deploying contracts with account:", deployer.address);
  const balanceWei = await ethers.provider.getBalance(deployer.address);
  console.log("Network:", `${network.name || "unknown"} (${network.chainId})`);
  console.log("Account balance:", `${ethers.formatEther(balanceWei)} MATIC`);
  if (feeData.gasPrice) {
    console.log("Gas price (provider):", `${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  }
  console.log("\n-------------------------------------------\n");

  // Deployment configuration
  const REQUIRED_SIGNATURES = 2; // Multi-sig requirement
  const PLATFORM_FEE_BPS = 50; // 0.5% platform fee
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;

  // Track deployed addresses
  const deployedContracts = {};

  // 1. Deploy AccessControl
  console.log("📋 Deploying TerraLedgerAccessControl...");
  const accessControl = await deployWithRetry(
    "TerraLedgerAccessControl",
    [deployer.address, REQUIRED_SIGNATURES],
    "TerraLedgerAccessControl"
  );
  const accessControlAddress = await accessControl.getAddress();
  deployedContracts.AccessControl = accessControlAddress;
  console.log("✅ TerraLedgerAccessControl deployed to:", accessControlAddress);

  // 2. Deploy LandRegistry
  console.log("\n📋 Deploying LandRegistry...");
  const landRegistry = await deployWithRetry(
    "LandRegistry",
    [accessControlAddress],
    "LandRegistry"
  );
  const landRegistryAddress = await landRegistry.getAddress();
  deployedContracts.LandRegistry = landRegistryAddress;
  console.log("✅ LandRegistry deployed to:", landRegistryAddress);

  // 3. Deploy EscrowContract
  console.log("\n📋 Deploying EscrowContract...");
  const escrowContract = await deployWithRetry(
    "EscrowContract",
    [landRegistryAddress, TREASURY_ADDRESS, PLATFORM_FEE_BPS],
    "EscrowContract"
  );
  const escrowContractAddress = await escrowContract.getAddress();
  deployedContracts.EscrowContract = escrowContractAddress;
  console.log("✅ EscrowContract deployed to:", escrowContractAddress);

  // 4. Deploy InheritanceManager
  console.log("\n📋 Deploying InheritanceManager...");
  const inheritanceManager = await deployWithRetry(
    "InheritanceManager",
    [landRegistryAddress, deployer.address],
    "InheritanceManager"
  );
  const inheritanceManagerAddress = await inheritanceManager.getAddress();
  deployedContracts.InheritanceManager = inheritanceManagerAddress;
  console.log("✅ InheritanceManager deployed to:", inheritanceManagerAddress);

  // 5. Deploy LandBoundary
  console.log("\n📋 Deploying LandBoundary...");
  const landBoundary = await deployWithRetry(
    "LandBoundary",
    [landRegistryAddress],
    "LandBoundary"
  );
  const landBoundaryAddress = await landBoundary.getAddress();
  deployedContracts.LandBoundary = landBoundaryAddress;
  console.log("✅ LandBoundary deployed to:", landBoundaryAddress);

  // Grant roles
  console.log("\n🔐 Setting up roles...");
  
  // Grant GOVERNMENT_ROLE to EscrowContract in LandRegistry for transfers
  const GOVERNMENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNMENT_ROLE"));
  await landRegistry.grantRole(GOVERNMENT_ROLE, escrowContractAddress);
  console.log("✅ Granted GOVERNMENT_ROLE to EscrowContract");

  // Grant SURVEYOR_ROLE to LandBoundary in LandRegistry
  const SURVEYOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SURVEYOR_ROLE"));
  await landRegistry.grantRole(SURVEYOR_ROLE, landBoundaryAddress);
  console.log("✅ Granted SURVEYOR_ROLE to LandBoundary");

  console.log("\n-------------------------------------------");
  console.log("🎉 Deployment Complete!\n");

  // Print summary
  console.log("📝 Deployed Contract Addresses:");
  console.log("-------------------------------------------");
  Object.entries(deployedContracts).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });

  // Save deployment info
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: Number(network.chainId),
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
    configuration: {
      requiredSignatures: REQUIRED_SIGNATURES,
      platformFeeBps: PLATFORM_FEE_BPS,
      treasury: TREASURY_ADDRESS,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const fileName = `deployment-${network.name || network.chainId}-${Date.now()}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filePath}`);

  // Also save to a latest.json for easy access
  const latestPath = path.join(deploymentsDir, `latest-${network.chainId}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Latest deployment saved to: ${latestPath}`);

  return deployedContracts;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    const message = typeof error?.message === "string" ? error.message : String(error);
    console.error("❌ Deployment failed:", message);

    // Improve the most common failure mode on testnets.
    if (message.toLowerCase().includes("insufficient funds")) {
      const overshotMatch = message.match(/overshot\s+(\d+)/i);
      if (overshotMatch?.[1]) {
        try {
          const overshotWei = BigInt(overshotMatch[1]);
          console.error(
            `\n💡 Top-up needed: ~${ethers.formatEther(overshotWei)} MATIC (plus a small buffer).`
          );
          console.error("   Fund this address:", error?.transaction?.from || "(see deployer address above)");
        } catch {
          // ignore
        }
      } else {
        console.error("\n💡 Your deployer wallet needs more MATIC for gas on this network.");
      }
    }

    process.exit(1);
  });
