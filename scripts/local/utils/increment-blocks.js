const { ethers } = require("hardhat");
const { logMessage } = require("./logging");

const incrementBlocks = async (blocks, debug) => {
  logMessage(`⬜ + ${blocks} blocks`, debug);
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
};

module.exports = { incrementBlocks };
