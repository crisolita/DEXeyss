/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("chai");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

let mnemonic = process.env.MNEMONIC
  ? process.env.MNEMONIC
  : "test test test test test test test test test test test test";

module.exports = {
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: `https://eth-mainnet.alchemyapi.io/v2/Wg8E8VyQ80iNWoyXwWuSJO0UygiQjLWg`,
        blockNumber: 11980054,
      },
    },
    testnet: {
      url: "https://data-seed-prebsc-2-s3.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [
        "c81a1bbd685a286bc3fb19e6547d05d48cd9d5f2eb860e731eb252679e5fefb6",
      ],
      saveDeployments: true,
    },
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [
        "c81a1bbd685a286bc3fb19e6547d05d48cd9d5f2eb860e731eb252679e5fefb6",
      ],
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API,
  },
  namedAccounts: {
    deployer: 0,
    feeRecipient: 1,
    user: 2,
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 50,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.CMC_API_KEY,
    excludeContracts: ["mocks/"],
  },
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 240000,
  },
};
