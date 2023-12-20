const { beforeTest } = require("./utils/before-test");
const { afterTest } = require("./utils/after-test");
const { sleep } = require("../utils/sleep");
const { incrementBlocks } = require("../utils/increment-blocks");
const { setValidatorsMock, setExpectedWithdrawalsMock } = require("../utils/set-consensus-mock");
const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers } = require("hardhat");
const { oraclesCronTimeoutInMs, unstakeBlockOffset } = require("../config");
const { logMessage } = require("../utils/logging");
const { parseUnits } = require("ethers/lib/utils");
const chaoticStakingTest = async (debug = false) => {
  const { user1, user2, user3, user4, user5, admin } = await getAccounts();
  const { stakedLyxToken, pool, rewards } = await getContracts();

  console.log("⌛ Chaotic Staking Test - Integration test...");

  try {
    await incrementBlocks(1, debug);

    logMessage("Multiple users stake concurrently", debug);
    await Promise.all([
      pool.connect(user1).stake({ value: ethers.utils.parseEther("60") }),
      pool.connect(user2).stake({ value: ethers.utils.parseEther("200") }),
      pool.connect(user3).stake({ value: ethers.utils.parseEther("100") }),
      pool.connect(user4).stake({ value: ethers.utils.parseEther("80") }),
      pool.connect(user5).stake({ value: ethers.utils.parseEther("150") }),
    ]);

    await setValidatorsMock([
      {
        amount: 18,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);
    await incrementBlocks(unstakeBlockOffset, debug);
    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    logMessage("Multiple unstake operations", debug);
    await Promise.all([
      stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30")),
      stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("100")),
      stakedLyxToken.connect(user3).unstake(ethers.utils.parseEther("50")),
    ]);

    await incrementBlocks(unstakeBlockOffset, debug);
    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    let currentBlock = await ethers.provider.getBlockNumber();

    await setExpectedWithdrawalsMock(
      new Array(5).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("32", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );
    await admin.sendTransaction({
      to: rewards.address,
      value: ethers.utils.parseEther("160"),
    });
    await incrementBlocks(3);

    await setValidatorsMock([
      {
        amount: 13,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 5,
        withdrawalAddress: rewards.address,
        balance: "0",
        slashed: false,
        status: "withdrawal_done",
      },
    ]);
    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    logMessage("User2 and User3 perform additional unstaking", debug);
    await Promise.all([
      stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("100")),
      stakedLyxToken.connect(user3).unstake(ethers.utils.parseEther("50")),
    ]);

    logMessage("Move forward in time", debug);
    await incrementBlocks(20);
    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    logMessage("User1 initiates another unstake", debug);
    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30"));

    logMessage("Move forward in time", debug);
    await incrementBlocks(20);
    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    logMessage("User2 initiates unstake claim", debug);
    await rewards.connect(user2).claimUnstake([2]);

    logMessage("Fast-forward time and update validator status", debug);
    await incrementBlocks(5);

    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    currentBlock = await ethers.provider.getBlockNumber();

    await setExpectedWithdrawalsMock(
      new Array(6).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("32", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );
    await incrementBlocks(3);

    await setValidatorsMock([
      {
        amount: 7,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 11,
        withdrawalAddress: rewards.address,
        balance: "0",
        slashed: false,
        status: "withdrawal_done",
      },
    ]);

    await sleep(oraclesCronTimeoutInMs + 1000); // Simulating the real-world delay

    logMessage("User3 initiates unstake claim", debug);
    await rewards.connect(user3).claimUnstake([3]);

    logMessage("Users restake after unstaking", debug);
    await Promise.all([
      pool.connect(user1).stake({ value: ethers.utils.parseEther("20") }),
      pool.connect(user2).stake({ value: ethers.utils.parseEther("50") }),
    ]);

    console.log("✅ Chaotic Staking Test - Success");
  } catch (e) {
    console.log("❌ Chaotic Staking Test - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => chaoticStakingTest(true).finally(() => afterTest()));
}

module.exports = { chaoticStakingTest };
