const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { beforeTest } = require("./utils/before-test");
const { incrementBlocks } = require("../utils/increment-blocks");
const { oraclesCronTimeoutInMs } = require("../config");
const { setValidatorsMock, setExpectedWithdrawalsMock } = require("../utils/set-consensus-mock");
const { parseUnits } = require("ethers/lib/utils");
const { afterTest } = require("./utils/after-test");
const { logMessage } = require("../utils/logging");

const rewardsSubmissionHappyPath = async (debug) => {
  const { user1, user2, user3, user4, user5, admin } = await getAccounts();
  const { stakedLyxToken, pool, rewards } = await getContracts();

  console.log("⌛ Rewards Submission - Integration test...");

  try {
    await rewards.connect(admin).setProtocolFee(0);
    logMessage("Protocol fee set to 0", debug);

    await incrementBlocks(1, debug);
    logMessage("Set syncing status to true", debug);

    // Step 1
    logMessage(`user1 stakes 2000`, debug);
    await pool.connect(user1).stake({ value: ethers.utils.parseEther("2000") });

    // Step 2
    logMessage(`user2 stakes 2000`, debug);
    await pool.connect(user2).stake({ value: ethers.utils.parseEther("2000") });

    await setValidatorsMock([
      {
        amount: 125,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);
    logMessage("⌛ wait for oracles to register validators", debug);
    await sleep(oraclesCronTimeoutInMs * 2, debug);

    await newWithdrawals(rewards, admin, 10, debug);

    expect(await rewards.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("5"));
    expect(await rewards.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("5"));

    // Step 4
    logMessage(`user1 cashes out rewards`, debug);
    await rewards.connect(user1).cashOutRewards(await rewards.balanceOf(user1.address));

    // Step 5
    await newWithdrawals(rewards, admin, 10, debug);

    // Step 6
    logMessage(`user1 stakes 1200`, debug);
    await pool.connect(user1).stake({ value: ethers.utils.parseEther("1200") });

    // Step 7
    await newWithdrawals(rewards, admin, 10, debug);

    // Step 8
    logMessage(`user2 unstakes 2000`, debug);
    await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("2000"));

    // Step 9
    logMessage(`user3 stakes 1000`, debug);
    await pool.connect(user3).stake({ value: ethers.utils.parseEther("1000") });

    // Step 10
    await sleep(oraclesCronTimeoutInMs * 1.5, debug); // simulated 11 hours sleep
    logMessage(`user4 stakes 3200`, debug);
    await pool.connect(user4).stake({ value: ethers.utils.parseEther("3200") });

    // Step 11
    await newWithdrawals(rewards, admin, 8, debug);
    expect(await rewards.balanceOf(user1.address)).to.equal("14613305613305612800");
    expect(await rewards.balanceOf(user2.address)).to.equal("13846153846153846000");
    expect(await rewards.balanceOf(user3.address)).to.equal("1081081081081081000");
    expect(await rewards.balanceOf(user4.address)).to.equal("3459459459459459200");

    // Step 12
    logMessage(`user1, user2 cash out rewards`, debug);
    await rewards.connect(user1).cashOutRewards(await rewards.balanceOf(user1.address));
    await rewards.connect(user2).cashOutRewards(await rewards.balanceOf(user2.address));

    expect(await rewards.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("0"));
    expect(await rewards.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("0"));
    expect(await rewards.balanceOf(user3.address)).to.equal("1081081081081081000");
    expect(await rewards.balanceOf(user4.address)).to.equal("3459459459459459200");

    // Step 13
    logMessage(`user1, user3 unstake`, debug);
    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("3200")); // unstake all (2000 initial + 1200 additional)
    await stakedLyxToken.connect(user3).unstake(ethers.utils.parseEther("1000"));

    // Step 14
    await sleep(oraclesCronTimeoutInMs, debug); // simulated 1 hour sleep
    logMessage(`user5 stakes 2000`, debug);
    await pool.connect(user5).stake({ value: ethers.utils.parseEther("2000") });

    // Step 15
    await sleep(oraclesCronTimeoutInMs, debug); // simulated 11 hours sleep
    await newWithdrawals(rewards, admin, 9, debug);

    expect(await rewards.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("0"));
    expect(await rewards.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("0"));
    expect(await rewards.balanceOf(user3.address)).to.equal("1081081081081081000");
    expect(await rewards.balanceOf(user4.address)).to.equal("8997920997920995200");
    expect(await rewards.balanceOf(user5.address)).to.equal("3461538461538460000");

    console.log("✅ Rewards Submission - Success");
  } catch (e) {
    console.log("❌ Rewards Submission - Failure");
    console.log(e);
  }
};

const newWithdrawals = async (rewards, admin, amount, debug) => {
  let currentBlock = await ethers.provider.getBlockNumber();
  logMessage(`${amount.toString()}LYX added to rewards`, debug);

  // Step 3
  await setExpectedWithdrawalsMock(
    new Array(amount).fill({
      address: rewards.address.toLowerCase(),
      amount: parseUnits("1", "gwei").toString(),
    }),
    (currentBlock + 2).toString()
  );

  await admin.sendTransaction({
    to: rewards.address,
    value: ethers.utils.parseEther(amount.toString()),
  });

  await incrementBlocks(6, debug);
  await sleep(oraclesCronTimeoutInMs * 1.5, debug);
};

if (require.main === module) {
  beforeTest().then(() => rewardsSubmissionHappyPath(true).finally(() => afterTest()));
}

module.exports = { rewardsSubmissionHappyPath };
