const { ethers } = require("hardhat");

const incrementBlocks = async (blocks) => {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
};

module.exports = { incrementBlocks };
