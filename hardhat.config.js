const { task, extendEnvironment } = require("hardhat/config");
const { gray, yellow } = require("chalk");

require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-truffle5");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("hardhat-abi-exporter");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");

require("dotenv").config();

const BLOCK_NUMBER = 12514;
const OPTIMIZER_RUNS = 5000000;
const log = (...text) => console.log(gray(...["└─> [DEBUG]"].concat(text)));

extendEnvironment((hre) => {
  hre.log = log;
});

function optimizeIfRequired({ hre, taskArguments: { optimizer } }) {
  if (optimizer || hre.optimizer) {
    // only show message once if re-run
    if (hre.optimizer === undefined) {
      log(gray("Adding optimizer, runs", yellow(OPTIMIZER_RUNS.toString())));
    }

    // Use optimizer (slower) but simulates real contract size limits and gas usage
    hre.config.solidity.compilers[0].settings.optimizer = {
      enabled: true,
      runs: OPTIMIZER_RUNS,
    };
    hre.config.networks.hardhat.allowUnlimitedContractSize = false;
  } else {
    if (hre.optimizer === undefined) {
      log(gray("Optimizer disabled. Unlimited contract sizes allowed."));
    }
    hre.config.solidity.compilers[0].settings.optimizer = { enabled: false };
    hre.config.networks.hardhat.allowUnlimitedContractSize = true;
  }

  // flag here so that if invoked via "hardhat test" the argument will persist to the compile stage
  hre.optimizer = !!optimizer;
}

task("compile")
  .addFlag("optimizer", "Compile with the optimizer")
  .setAction(async (taskArguments, hre, runSuper) => {
    optimizeIfRequired({ hre, taskArguments });
    await runSuper(taskArguments);
  });

task("coverage").setAction(async (taskArguments, hre, runSuper) => {
  log(gray("Mainnet fork with block number", yellow(BLOCK_NUMBER.toString())));

  await runSuper(taskArguments);
});

task("verify")
  .addFlag("optimizer", "Compile with the optimizer")
  .setAction(async (taskArguments, hre, runSuper) => {
    optimizeIfRequired({ hre, taskArguments });
    await runSuper(taskArguments);
  });

module.exports = {
  solidity: {
    version: "0.8.20",
  },
  etherscan: {
    apiKey: "no-api-key-needed",
    customChains: [
      {
        network: "luksoTestnet",
        chainId: 4201,
        urls: {
          apiURL: "https://api.explorer.execution.testnet.lukso.network/api",
          browserURL: "https://explorer.execution.testnet.lukso.network/",
        },
      },
      {
        network: "luksoMainnet",
        chainId: 42,
        urls: {
          apiURL: "https://api.explorer.execution.mainnet.lukso.network/api",
          browserURL: "https://explorer.execution.mainnet.lukso.network/",
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "1000000000000000000000000",
      },
    },
    local: {
      url: "http://127.0.0.1:8545/",
    },
    luksoTestnet: {
      url: `https://rpc.testnet.lukso.network`, // Replace this with the RPC URL for your custom network
      chainId: 4201, // The chain ID of the custom network (replace with the correct value)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
      // You can also set other network-specific configurations, such as gas and block gas limit
    },
    luksoMainnet: {
      url: `https://rpc.mainnet.lukso.network`, // Replace this with the RPC URL for your custom network
      chainId: 42, // The chain ID of the custom network (replace with the correct value)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
      // You can also set other network-specific configurations, such as gas and block gas limit
    },
    luksoDevnet: {
      url: `https://rpc.devnet.lukso.dev/`, // Replace this with the RPC URL for your custom network
      chainId: 7420, // The chain ID of the custom network (replace with the correct value)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
      // You can also set other network-specific configurations, such as gas and block gas limit
    },
    sepolia: {
      url: "https://rpc2.sepolia.org/ ", // Replace this with the RPC URL for your custom network
      chainId: 11155111, // The chain ID of the custom network (replace with the correct value)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
      // You can also set other network-specific configurations, such as gas and block gas limit
    },
  },
  throwOnTransactionFailures: true,
  gasReporter: {
    enabled: false,
    showTimeSpent: true,
    currency: "USD",
    maxMethodDiff: 25, // CI will fail if gas usage is > than this %
    gasPrice: 75,
    excludeContracts: ["mocks/"],
  },
  abiExporter: {
    path: "./abi",
    only: [
      "AccessControl",
      "Oracles",
      "IDepositContract",
      "Pool",
      "PoolEscrow",
      "PoolValidators",
      "Rewards",
      "StakedLyxToken",
      "StakeWiseToken",
      "VestingEscrow",
      "VestingEscrowFactory",
      "MerkleDrop",
      "MerkleDistributor",
      "ContractChecker",
      "Roles",
    ],
    clear: true,
    flat: true,
  },
  mocha: {
    timeout: 1000000,
  },
};
