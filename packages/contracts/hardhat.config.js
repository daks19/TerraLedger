require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const POLYGON_MUMBAI_RPC = process.env.POLYGON_MUMBAI_RPC || "https://rpc-mumbai.maticvigil.com/";
const POLYGON_MAINNET_RPC = process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com/";
const POLYGON_AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

const SOLC_OPTIMIZER_RUNS = Number(process.env.SOLC_OPTIMIZER_RUNS || 200);
const SOLC_VIA_IR = String(process.env.SOLC_VIA_IR ?? "true").toLowerCase() === "true";

const accounts =
  PRIVATE_KEY &&
  PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    ? [PRIVATE_KEY]
    : [];

const POLYGON_AMOY_GAS_PRICE_GWEI = process.env.POLYGON_AMOY_GAS_PRICE_GWEI
  ? Number(process.env.POLYGON_AMOY_GAS_PRICE_GWEI)
  : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: SOLC_OPTIMIZER_RUNS,
      },
      viaIR: SOLC_VIA_IR,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    polygon_mumbai: {
      url: POLYGON_MUMBAI_RPC,
      accounts,
      chainId: 80001,
      gasPrice: 35000000000, // 35 gwei
    },
    polygon_amoy: {
      url: POLYGON_AMOY_RPC,
      accounts,
      chainId: 80002,
      gasPrice: POLYGON_AMOY_GAS_PRICE_GWEI
        ? Math.floor(POLYGON_AMOY_GAS_PRICE_GWEI * 1e9)
        : undefined,
    },
    polygon_mainnet: {
      url: POLYGON_MAINNET_RPC,
      accounts,
      chainId: 137,
      gasPrice: 50000000000, // 50 gwei
    },
    sepolia: {
      url: SEPOLIA_RPC,
      accounts,
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: POLYGONSCAN_API_KEY,
      polygonAmoy: POLYGONSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "MATIC",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};
