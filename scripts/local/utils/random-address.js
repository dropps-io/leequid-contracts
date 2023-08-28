const { ethers } = require("ethers");

function generateRandomEthAddress() {
  let address = "0x";
  ethers.utils.randomBytes(20).map((v) => (address += v.toString(16).padStart(2, "0")));
  return address;
}

module.exports = { generateRandomEthAddress };
