const { ethers } = require("hardhat");

const resetNetwork = async (mute) => {
  if (!mute) console.log("Resetting Hardhat network.");
  await ethers.provider.send("hardhat_reset");
};

module.exports = { resetNetwork };
