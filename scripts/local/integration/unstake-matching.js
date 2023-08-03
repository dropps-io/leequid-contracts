const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { beforeTest } = require("./utils/before-test");

const { afterTest } = require("./utils/after-test");
const { ethers } = require("hardhat");
const { unstakeBlockOffset, oraclesCronTimeoutInMs } = require("../config");
const { incrementBlocks } = require("../utils/increment-blocks");
const { sleep } = require("../utils/sleep");
const { logMessage } = require("../utils/logging");

const unstakeMatching = async (debug = false) => {
  const { user1, user2, user3, user4 } = await getAccounts();
  const { stakedLyxToken, pool, rewards } = await getContracts();

  console.log("⌛ Unstakes matching - Integration test...");

  try {
    await pool.connect(user1).stake({ value: ethers.utils.parseEther("60") });
    logMessage("user1 staked 60 LYX", debug);
    await pool.connect(user2).stake({ value: ethers.utils.parseEther("200") });
    logMessage("user2 staked 200 LYX", debug);

    await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("60"));
    logMessage("user1 requested to unstake 60 LYX", debug);

    let user1StakedBalance = await stakedLyxToken.balanceOf(user1.address);
    let unstakeRequest1 = await stakedLyxToken.unstakeRequest(1);
    let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

    expect(user1StakedBalance).to.equal(ethers.utils.parseEther("0"));
    expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("60"));
    expect(unstakeRequest1.amount).to.equal(ethers.utils.parseEther("60"));

    logMessage("Incrementing blocks (equivalent of 12h) ⌛ waiting for oracles to process", debug);
    await incrementBlocks(unstakeBlockOffset / 2);
    await sleep(oraclesCronTimeoutInMs + 1000);

    await pool.connect(user3).stake({ value: ethers.utils.parseEther("30") });
    logMessage("user3 staked 30 LYX", debug);

    let rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    unstakeRequest1 = await stakedLyxToken.unstakeRequest(1);
    totalPendingUnstakes = await stakedLyxToken.totalPendingUnstake();

    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("30"));
    expect(unstakeRequest1.amountFilled).to.equal(ethers.utils.parseEther("30"));
    expect(totalPendingUnstakes).to.equal(ethers.utils.parseEther("30"));

    logMessage("Incrementing blocks (equivalent of 3h) ⌛ waiting for oracles to process", debug);
    await incrementBlocks(unstakeBlockOffset / 8);
    await sleep(oraclesCronTimeoutInMs + 1000);

    await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("100"));
    logMessage("user2 requested to unstake 100 LYX", debug);

    let user2StakedBalance = await stakedLyxToken.balanceOf(user2.address);
    let unstakeRequest2 = await stakedLyxToken.unstakeRequest(2);
    totalPendingUnstakes = await stakedLyxToken.totalPendingUnstake();

    expect(user2StakedBalance).to.equal(ethers.utils.parseEther("100"));
    expect(unstakeRequest2.amount).to.equal(ethers.utils.parseEther("100"));
    expect(totalPendingUnstakes).to.equal(ethers.utils.parseEther("130"));

    await pool.connect(user4).stake({ value: ethers.utils.parseEther("50") });
    logMessage("user4 staked 50 LYX", debug);

    rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    unstakeRequest2 = await stakedLyxToken.unstakeRequest(2);
    let unstakeRequest1Claimable = await stakedLyxToken.isUnstakeRequestClaimable(1);
    let totalClaimableUnstakes = await stakedLyxToken.totalClaimableUnstakes();
    totalPendingUnstakes = await stakedLyxToken.totalPendingUnstake();

    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("80"));
    expect(unstakeRequest2.amountFilled).to.equal(ethers.utils.parseEther("20"));
    expect(unstakeRequest1Claimable).to.equal(true);
    expect(totalClaimableUnstakes).to.equal(ethers.utils.parseEther("60"));
    expect(totalPendingUnstakes).to.equal(ethers.utils.parseEther("80"));

    let user1BalanceBefore = await ethers.provider.getBalance(user1.address);

    await rewards.connect(user1).claimUnstake([1]);
    logMessage("user1 claimed unstake 1", debug);

    rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
    let user1Balance = await ethers.provider.getBalance(user1.address);
    unstakeRequest1Claimable = await stakedLyxToken.isUnstakeRequestClaimable(1);

    expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("20"));
    expect(user1BalanceBefore.add(ethers.utils.parseEther("60")).toString().slice(0, 4)).to.equal(
      user1Balance.toString().slice(0, 4)
    );
    expect(unstakeRequest1Claimable).to.equal(false);

    logMessage("Incrementing blocks (equivalent of 12h) ⌛ waiting for oracles to process", debug);
    await incrementBlocks(unstakeBlockOffset / 2);
    await sleep(oraclesCronTimeoutInMs + 1000);

    let isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
    expect(isUnstakeProcessing).to.equal(false);

    logMessage("Incrementing blocks (equivalent of 12h) ⌛ waiting for oracles to process", debug);
    await incrementBlocks(unstakeBlockOffset / 2);
    await sleep(oraclesCronTimeoutInMs + 1000);

    isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
    expect(isUnstakeProcessing).to.equal(true);

    console.log("✅ Unstakes matching - Success");
  } catch (e) {
    console.log("❌ Unstakes matching - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => unstakeMatching(true).finally(() => afterTest()));
}

module.exports = { unstakeMatching };
