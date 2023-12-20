const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const {
  depositDataMerkleRoot,
  oraclesAddresses,
  orchestratorAddress,
  depositDataMerkleProofs,
} = require("../config");
const { ethers } = require("hardhat");

const initProtocol = async (mute) => {
  const { admin, operator } = await getAccounts();
  const { poolValidators, oracles, swapV1Mock, stakedLyxToken } = await getContracts();

  await poolValidators
    .connect(admin)
    .addOperator(operator.address, depositDataMerkleRoot, depositDataMerkleProofs);

  if (!mute) console.log("Operator address: ", operator.address);

  await poolValidators.connect(operator).commitOperator();

  if (!mute) console.log("Operator added and committed");

  for (const oracleAddress of oraclesAddresses)
    await oracles.connect(admin).addOracle(oracleAddress);

  await oracles.connect(admin).addOrchestrator(orchestratorAddress);

  await stakedLyxToken.connect(admin).toggleRewards(swapV1Mock.address, true);

  await admin.sendTransaction({ to: orchestratorAddress, value: ethers.utils.parseEther("1") });
};

module.exports = { initProtocol };
