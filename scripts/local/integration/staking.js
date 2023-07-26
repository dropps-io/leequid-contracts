const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { oraclesRegisterValidatorsTimeoutInMs } = require("../config");
const { beforeTest } = require("./utils/before-test");

const stakingHappyPath = async () => {
  const { user1, user2, user3, user4, user5 } = await getAccounts();
  const { stakedLyxToken, pool } = await getContracts();

  console.log("⌛ Staking Happy Path - Integration test...");

  await pool.connect(user1).stake({ value: ethers.utils.parseEther("5") });
  await pool.connect(user2).stake({ value: ethers.utils.parseEther("20") });
  await pool.connect(user3).stake({ value: ethers.utils.parseEther("21340") });
  await pool.connect(user1).stake({ value: ethers.utils.parseEther("13") });
  await pool.connect(user4).stake({ value: ethers.utils.parseEther("55") });
  await pool.connect(user5).stake({ value: ethers.utils.parseEther("1400") });
  await pool.connect(user4).stake({ value: ethers.utils.parseEther("200") });

  const user1Balance = await stakedLyxToken.balanceOf(user1.address);
  const user2Balance = await stakedLyxToken.balanceOf(user2.address);
  const user3Balance = await stakedLyxToken.balanceOf(user3.address);
  const user4Balance = await stakedLyxToken.balanceOf(user4.address);
  const user5Balance = await stakedLyxToken.balanceOf(user5.address);
  const totalSupply = await stakedLyxToken.totalSupply();

  expect(user1Balance).to.equal(ethers.utils.parseEther("18"));
  expect(user2Balance).to.equal(ethers.utils.parseEther("20"));
  expect(user3Balance).to.equal(ethers.utils.parseEther("21340"));
  expect(user4Balance).to.equal(ethers.utils.parseEther("255"));
  expect(user5Balance).to.equal(ethers.utils.parseEther("1400"));
  expect(totalSupply).to.equal(ethers.utils.parseEther("23033"));

  await sleep(oraclesRegisterValidatorsTimeoutInMs + 1000 * 30);

  const poolBalance = await ethers.provider.getBalance(pool.address);
  const pendingValidators = await pool.pendingValidators();

  expect(pendingValidators).to.equal("719");
  expect(poolBalance).to.equal(ethers.utils.parseEther("25"));

  console.log("✅ Staking Happy Path - Success");
};

beforeTest().then(() => stakingHappyPath());
