const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");

const { beforeTest } = require("./utils/before-test");

const { afterTest } = require("./utils/after-test");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { oraclesCronTimeoutInMs, unstakeBlockOffset } = require("../config");
const { logMessage } = require("../utils/logging");
const { incrementBlocks } = require("../utils/increment-blocks");
const {
  setValidatorsMock,
  setFinalityCheckpointsMock,
  setExpectedWithdrawalsMock,
} = require("../utils/set-consensus-mock");

const validatorsPenalizedIntegration = async (debug = false) => {
  const { user1 } = await getAccounts();
  const { pool, rewards, stakedLyxToken } = await getContracts();

  try {
    console.log("⌛ Validators penalized - Integration test...");

    await pool.connect(user1).stake({ value: ethers.utils.parseEther((32 * 50).toString()) });
    logMessage("user1 staked 1600 LYX, ⌛ waiting for oracles to register 50 validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    await setValidatorsMock([
      {
        amount: 50,
        withdrawalAddress: rewards.address,
        balance: "31980000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);

    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("96"));
    logMessage(
      "User1 requested to unstake 96LYX, ⌛ waiting for oracles to start processing the unstake",
      debug
    );
    await incrementBlocks(unstakeBlockOffset);
    await sleep(oraclesCronTimeoutInMs + 1000);

    const currentBlock = await ethers.provider.getBlockNumber();
    await setFinalityCheckpointsMock({ finalized: { epoch: "100" } });
    await setExpectedWithdrawalsMock(
      [
        { amount: "31980000000", address: rewards.address.toLowerCase() },
        { amount: "31980000000", address: rewards.address.toLowerCase() },
        { amount: "31980000000", address: rewards.address.toLowerCase() },
        { amount: "180000000", address: rewards.address.toLowerCase() },
        { amount: "180000000", address: user1.address.toLowerCase() },
        { amount: "280000000", address: rewards.address.toLowerCase() },
      ],
      (currentBlock + 1).toString()
    );

    await setValidatorsMock([
      {
        amount: 47,
        withdrawalAddress: rewards.address,
        balance: "31980000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 3,
        withdrawalAddress: rewards.address,
        balance: "0",
        slashed: false,
        status: "active_ongoing",
      },
    ]);

    logMessage(
      "Mocks set with exited validators and withdrawals, ⌛ waiting for oracles to process",
      debug
    );
    await incrementBlocks(2);
    await sleep(oraclesCronTimeoutInMs + oraclesCronTimeoutInMs / 2);

    const unstakeRequestClaimable = await stakedLyxToken.isUnstakeRequestClaimable(1);
    const totalRewards = await rewards.totalRewards();

    expect(unstakeRequestClaimable).to.be.true;
    expect(totalRewards).to.equal(ethers.utils.parseEther("0.4"));

    console.log("✅ Validators penalized - Success");
  } catch (e) {
    console.log("❌ Validators penalized - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => validatorsPenalizedIntegration(true).finally(() => afterTest()));
}

module.exports = { validatorsPenalizedIntegration };
