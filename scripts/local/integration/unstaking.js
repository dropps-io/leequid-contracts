const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { beforeTest } = require("./utils/before-test");
const { incrementBlocks } = require("../utils/increment-blocks");
const { oraclesCronTimeoutInMs, unstakeBlockOffset } = require("../config");
const {
  setValidatorWithdrawalCredentialsMock,
  setValidatorMock,
} = require("../utils/set-consensus-mock");

const unstakingHappyPath = async () => {
  const { user1, user2 } = await getAccounts();
  const { stakedLyxToken, pool, rewards } = await getContracts();

  console.log("⌛ Unstaking Happy Path - Integration test...");

  await pool.connect(user1).stake({ value: ethers.utils.parseEther("60") });
  await pool.connect(user2).stake({ value: ethers.utils.parseEther("200") });

  await setValidatorWithdrawalCredentialsMock([{ validatorindex: "3" }]);
  await setValidatorMock(
    new Array(8).fill({
      slashed: false,
      effectivebalance: 32000000000,
      status: "active_online",
      total_withdrawals: 0,
    })
  );

  let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("0"));

  await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30"));

  let user1SLyxBalance = await stakedLyxToken.balanceOf(user1.address);
  let unstakeRequest1 = await stakedLyxToken.unstakeRequest(1);
  totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

  expect(user1SLyxBalance).to.equal(ethers.utils.parseEther("30"));
  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("30"));
  expect(unstakeRequest1.amount).to.equal(ethers.utils.parseEther("30"));

  // Equivalent to 12 hours
  await incrementBlocks(unstakeBlockOffset / 2);
  await sleep(oraclesCronTimeoutInMs);

  await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("200"));

  let user2SLyxBalance = await stakedLyxToken.balanceOf(user2.address);
  let unstakeRequest2 = await stakedLyxToken.unstakeRequest(2);
  totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

  expect(user2SLyxBalance).to.equal(ethers.utils.parseEther("0"));
  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("230"));
  expect(unstakeRequest2.amount).to.equal(ethers.utils.parseEther("200"));

  // Equivalent to 20 hours
  await incrementBlocks(unstakeBlockOffset * 0.83);
  await sleep(oraclesCronTimeoutInMs);

  await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("30"));

  user1SLyxBalance = await stakedLyxToken.balanceOf(user1.address);
  let unstakeRequest3 = await stakedLyxToken.unstakeRequest(3);
  totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();

  expect(user1SLyxBalance).to.equal(ethers.utils.parseEther("0"));
  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("260"));
  expect(unstakeRequest3.amount).to.equal(ethers.utils.parseEther("30"));

  await incrementBlocks(unstakeBlockOffset * 0.4);
  await sleep(oraclesCronTimeoutInMs);

  let isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
  totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
  const unstakeReadyEvents = await stakedLyxToken.queryFilter("UnstakeReady");

  expect(isUnstakeProcessing).to.equal(true);
  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("260"));
  expect(unstakeReadyEvents.length).to.equal(1);
  expect(unstakeReadyEvents[0].args.validatorsToExit).to.equal("8");

  await setValidatorMock(
    new Array(8).fill({
      slashed: false,
      effectivebalance: 0,
      status: "exited",
      total_withdrawals: 32000000000,
    })
  );

  await sleep(oraclesCronTimeoutInMs);
  // Send the equivalent of the unstake
  await user1.sendTransaction({ to: rewards.address, value: ethers.utils.parseEther("256") });

  isUnstakeProcessing = await stakedLyxToken.unstakeProcessing();
  totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
  let rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
  let isClaimable1 = await stakedLyxToken.isUnstakeRequestClaimable(1);
  let isClaimable2 = await stakedLyxToken.isUnstakeRequestClaimable(2);
  const isClaimable3 = await stakedLyxToken.isUnstakeRequestClaimable(3);
  unstakeRequest3 = await stakedLyxToken.unstakeRequest(3);

  expect(isUnstakeProcessing).to.equal(false);
  expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("4"));
  expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("256"));
  expect(isClaimable1).to.equal(true);
  expect(isClaimable2).to.equal(true);
  expect(isClaimable3).to.equal(false);
  expect(unstakeRequest3.amountFilled).to.equal(ethers.utils.parseEther("26"));

  const user1BalanceBefore = await ethers.provider.getBalance(user1.address);

  await rewards.connect(user1).claimUnstake([1]);

  isClaimable1 = await stakedLyxToken.isUnstakeRequestClaimable(1);
  rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
  const user1BalanceAfter = await ethers.provider.getBalance(user1.address);

  expect(isClaimable1).to.equal(false);
  expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("226"));
  assert(user1BalanceAfter.gt(user1BalanceBefore), "User1 balance should be greater after claim");

  const user2BalanceBefore = await ethers.provider.getBalance(user2.address);

  await rewards.connect(user2).claimUnstake([2]);

  const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
  rewardsContractBalance = await ethers.provider.getBalance(rewards.address);
  isClaimable2 = await stakedLyxToken.isUnstakeRequestClaimable(2);

  assert(user2BalanceAfter.gt(user2BalanceBefore), "User2 balance should be greater after claim");
  expect(isClaimable2).to.equal(false);
  expect(rewardsContractBalance).to.equal(ethers.utils.parseEther("26"));

  console.log("✅ Unstaking Happy Path - Success");
};

beforeTest().then(() => unstakingHappyPath());
