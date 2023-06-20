const { ethers } = require('hardhat');

const getAccounts = async () => {
  const accounts = await ethers.getSigners();
  const [
    admin,
    protocolFeeRecipient,
    operator,
    user1,
    user2,
    user3,
    oracle1,
    oracle2,
  ] = accounts;
  return {
    admin,
    protocolFeeRecipient,
    operator,
    user1,
    user2,
    user3,
    oracle1,
    oracle2,
  };
};

module.exports = { getAccounts };
