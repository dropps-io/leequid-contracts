const { ethers } = require("hardhat");

const getAccounts = async () => {
  const accounts = await ethers.getSigners();
  const [
    admin,
    protocolFeeRecipient,
    operator,
    user1,
    user2,
    user3,
    user4,
    user5,
    chain,
    proxyOwner,
  ] = accounts;
  return {
    admin,
    protocolFeeRecipient,
    operator,
    user1,
    user2,
    user3,
    user4,
    user5,
    chain,
    proxyOwner,
  };
};

module.exports = { getAccounts };
