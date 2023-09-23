const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { beforeTest } = require("./utils/before-test");
const { incrementBlocks } = require("../utils/increment-blocks");
const { oraclesCronTimeoutInMs, unstakeBlockOffset } = require("../config");
const {
  setValidatorsMock,
  setFinalityCheckpointsMock,
  setExpectedWithdrawalsMock,
} = require("../utils/set-consensus-mock");
const { parseUnits } = require("ethers/lib/utils");
const { afterTest } = require("./utils/after-test");
const { logMessage } = require("../utils/logging");

const unstakingHappyPath = async (debug = true) => {
  const { user1, user2 } = await getAccounts();
  const { stakedLyxToken, pool, rewards } = await getContracts();

  console.log("⌛ Unstaking Happy Path - Integration test...");

  try {
    await pool.connect(user1).stake({ value: ethers.utils.parseEther("60") });
    await pool.connect(user2).stake({ value: ethers.utils.parseEther("200") });

    logMessage("User1 and User2 successfully staked.", debug);

    await setFinalityCheckpointsMock({ finalized: { epoch: "100" } });

    logMessage("Finality checkpoints mock set.", debug);

    let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

    logMessage(
      `Total pending unstake before User1 unstakes: ${totalPendingUnstake.toString()}`,
      debug
    );

    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("0"));

    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30"));

    logMessage("User1 initiated unstaking of 30 SLYX tokens.", debug);

    let user1SLyxBalance = await stakedLyxToken.balanceOf(user1.address);
    let unstakeRequest1 = await stakedLyxToken.unstakeRequest(1);
    totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

    logMessage(`User1 SLyX Balance after unstaking: ${user1SLyxBalance.toString()}`, debug);
    logMessage(
      `Total pending unstake after User1 unstakes: ${totalPendingUnstake.toString()}`,
      debug
    );

    expect(user1SLyxBalance).to.equal(ethers.utils.parseEther("30"));
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("30"));
    expect(unstakeRequest1.amount).to.equal(ethers.utils.parseEther("30"));

    // Equivalent to 12 hours
    await incrementBlocks(unstakeBlockOffset / 2);
    await sleep(oraclesCronTimeoutInMs);

    logMessage("Simulated 12 hours passed.", debug);

    await setValidatorsMock([
      {
        amount: 8,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);

    logMessage("Validators mock set.", debug);

    await sleep(oraclesCronTimeoutInMs);

    await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("200"));

    logMessage("User2 initiated unstaking of 200 SLYX tokens.", debug);

    let user2SLyxBalance = await stakedLyxToken.balanceOf(user2.address);
    let unstakeRequest2 = await stakedLyxToken.unstakeRequest(2);
    totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

    logMessage(`User2 SLyX Balance after unstaking: ${user2SLyxBalance.toString()}`, debug);
    logMessage(
      `Total pending unstake after User2 unstakes: ${totalPendingUnstake.toString()}`,
      debug
    );

    expect(user2SLyxBalance).to.equal(ethers.utils.parseEther("0"));
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("230"));
    expect(unstakeRequest2.amount).to.equal(ethers.utils.parseEther("200"));

    // Equivalent to 20 hours
    await incrementBlocks(unstakeBlockOffset * 0.83);
    await sleep(oraclesCronTimeoutInMs);

    logMessage("Simulated 20 hours passed.", debug);

    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30"));

    logMessage("User1 initiated unstaking of 30 SLYX tokens.", debug);

    let isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
    user1SLyxBalance = await stakedLyxToken.balanceOf(user1.address);
    let unstakeRequest3 = await stakedLyxToken.unstakeRequest(3);
    totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

    logMessage(`Is unstake processing: ${isUnstakeProcessing}`, debug);
    logMessage(`User1 SLyX Balance after unstaking: ${user1SLyxBalance.toString()}`, debug);
    logMessage(
      `Total pending unstake after User1 unstakes: ${totalPendingUnstake.toString()}`,
      debug
    );

    expect(isUnstakeProcessing).to.equal(false);
    expect(user1SLyxBalance).to.equal(ethers.utils.parseEther("0"));
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("260"));
    expect(unstakeRequest3.amount).to.equal(ethers.utils.parseEther("30"));

    await incrementBlocks(unstakeBlockOffset * 0.4);
    await sleep(oraclesCronTimeoutInMs);

    logMessage("Simulated additional time passed.", debug);

    isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
    totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
    const unstakeReadyEvents = await stakedLyxToken.queryFilter("UnstakeReady");

    logMessage(`Is unstake processing: ${isUnstakeProcessing}`, debug);
    logMessage(`Total pending unstake: ${totalPendingUnstake.toString()}`, debug);
    logMessage(`UnstakeReady events: ${unstakeReadyEvents.length}`, debug);
    logMessage(`Validators to exit: ${unstakeReadyEvents[0].args.validatorsToExit}`, debug);

    expect(isUnstakeProcessing).to.equal(true);
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("260"));
    expect(unstakeReadyEvents.length).to.equal(1);
    expect(unstakeReadyEvents[0].args.validatorsToExit).to.equal("8");

    const currentBlock = await ethers.provider.getBlockNumber();

    logMessage(`Current block number: ${currentBlock}`, debug);

    await setExpectedWithdrawalsMock(
      new Array(8).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("32", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );

    logMessage("Set expected withdrawals mock with a delay of 2 blocks.", debug);

    await setValidatorsMock([
      {
        amount: 8,
        withdrawalAddress: rewards.address,
        balance: "0",
        slashed: false,
        status: "withdrawal_done",
      },
    ]);

    logMessage("Set validators mock.", debug);

    await incrementBlocks(5);

    logMessage("Simulated increment of 5 blocks.", debug);

    // Send the equivalent of the unstake
    await user1.sendTransaction({ to: rewards.address, value: ethers.utils.parseEther("256") });

    logMessage("User1 sent a transaction of 256 ETH to rewards contract.", debug);

    await sleep(oraclesCronTimeoutInMs + 2000);

    logMessage("Simulated sleep for oraclesCronTimeoutInMs + 2000 ms.", debug);

    isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
    totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
    let rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    let isClaimable1 = await stakedLyxToken.isUnstakeRequestClaimable(1);
    let isClaimable2 = await stakedLyxToken.isUnstakeRequestClaimable(2);
    const isClaimable3 = await stakedLyxToken.isUnstakeRequestClaimable(3);
    unstakeRequest3 = await stakedLyxToken.unstakeRequest(3);

    logMessage(`Is unstake processing: ${isUnstakeProcessing}`, debug);
    logMessage(`Total pending unstake: ${totalPendingUnstake.toString()}`, debug);
    logMessage(`Rewards contract balance: ${rewardsContractBalance.toString()}`, debug);
    logMessage(`Is Claimable (Request 1): ${isClaimable1}`, debug);
    logMessage(`Is Claimable (Request 2): ${isClaimable2}`, debug);
    logMessage(`Is Claimable (Request 3): ${isClaimable3}`, debug);
    logMessage(
      `Unstake Request 3 amount filled: ${unstakeRequest3.amountFilled.toString()}`,
      debug
    );

    expect(isUnstakeProcessing).to.equal(false);
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("4"));
    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("256"));
    expect(isClaimable1).to.equal(true);
    expect(isClaimable2).to.equal(true);
    expect(isClaimable3).to.equal(false);
    expect(unstakeRequest3.amountFilled).to.equal(ethers.utils.parseEther("26"));

    const user1BalanceBefore = await ethers.provider.getBalance(user1.address);

    logMessage(`User1 balance before claiming: ${user1BalanceBefore.toString()}`, debug);

    await rewards.connect(user1).claimUnstake([1]);

    logMessage("User1 claimed unstaked funds (Request 1).", debug);

    isClaimable1 = await stakedLyxToken.isUnstakeRequestClaimable(1);
    rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    const user1BalanceAfter = await ethers.provider.getBalance(user1.address);

    logMessage(`Is Claimable (Request 1): ${isClaimable1}`, debug);
    logMessage(
      `Rewards contract balance after claim: ${rewardsContractBalance.toString()}`,
      debug
    );
    logMessage(`User1 balance after claiming: ${user1BalanceAfter.toString()}`, debug);

    expect(isClaimable1).to.equal(false);
    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("226"));
    assert(
      user1BalanceAfter.gt(user1BalanceBefore),
      "User1 balance should be greater after claim"
    );

    const user2BalanceBefore = await ethers.provider.getBalance(user2.address);

    logMessage(`User2 balance before claiming: ${user2BalanceBefore.toString()}`, debug);

    await rewards.connect(user2).claimUnstake([2]);

    logMessage("User2 claimed unstaked funds (Request 2).", debug);

    const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
    rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    isClaimable2 = await stakedLyxToken.isUnstakeRequestClaimable(2);

    logMessage(`User2 balance after claiming: ${user2BalanceAfter.toString()}`, debug);
    logMessage(
      `Rewards contract balance after claim: ${rewardsContractBalance.toString()}`,
      debug
    );
    logMessage(`Is Claimable (Request 2): ${isClaimable2}`, debug);

    assert(
      user2BalanceAfter.gt(user2BalanceBefore),
      "User2 balance should be greater after claim"
    );
    expect(isClaimable2).to.equal(false);
    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("26"));

    console.log("✅ Unstaking Happy Path - Success");
  } catch (e) {
    console.log("❌ Unstaking Happy Path - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => unstakingHappyPath().finally(() => afterTest()));
}

module.exports = { unstakingHappyPath };
