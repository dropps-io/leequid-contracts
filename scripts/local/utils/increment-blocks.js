const { ethers } = require("hardhat");
const { logMessage } = require("./logging");
const { setSyncingStatusMock } = require("./set-consensus-mock");

const incrementBlocks = async (blocks, debug) => {
  logMessage(`⬜ + ${blocks} blocks`, debug);
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
  const blockNumber = await ethers.provider.getBlockNumber();
  setSyncingStatusMock({ syncing_status: true, head_slot: blockNumber });
};

module.exports = { incrementBlocks };
