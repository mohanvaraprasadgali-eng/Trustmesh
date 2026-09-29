require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // Use the locally-installed solc npm package instead of downloading a native binary.
  // This avoids HH501 network errors on restricted connections.
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  networks: {
    // Local Hardhat network for testing
    hardhat: {
      chainId: 31337,
    },

    // MST Testnet — official hackathon network
    mst_testnet: {
      url: process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com",
      chainId: process.env.MST_CHAIN_ID ? parseInt(process.env.MST_CHAIN_ID) : 91562037,
      // Private key loaded from .env — NEVER hardcode here
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  // Hardhat contract verification (if MST supports etherscan-compatible API)
  etherscan: {
    apiKey: {
      mst_testnet: "not-required",
    },
    customChains: [
      {
        network: "mst_testnet",
        chainId: process.env.MST_CHAIN_ID ? parseInt(process.env.MST_CHAIN_ID) : 91562037,
        urls: {
          apiURL: "https://mstscan.com/api",
          browserURL: "https://mstscan.com",
        },
      },
    ],
  },
};
