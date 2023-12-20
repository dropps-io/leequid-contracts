const { getContracts } = require("../utils/get-contracts");
const { ethers } = require("hardhat");
const { formatEther } = require("ethers/lib/utils");
const { getAccounts } = require("../utils/get-accounts");

class Protocol {
  constructor() {
    setInterval(() => {
      this.getData().then((data) => this.logData(data));
    }, 10000);
  }

  async getData() {
    const { mockBeacon, pool, rewards, swapV1Mock, stakedLyxToken } = await getContracts();

    const rewardsBalance = await ethers.provider.getBalance(rewards.address);
    const poolBalance = await ethers.provider.getBalance(pool.address);
    const depositBalance = await ethers.provider.getBalance(mockBeacon.address);
    const swapSLYXBalance = await stakedLyxToken.balanceOf(swapV1Mock.address);
    const totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
    const totalClaimableUnstakes = await stakedLyxToken.totalClaimableUnstakes();
    const totalUnstaked = await stakedLyxToken.totalUnstaked();
    const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
    const totalAvailableRewards = await rewards.totalAvailableRewards();
    const totalRewards = await rewards.totalRewards();
    const protocolFee = await rewards.protocolFee();
    const minActivatingDeposit = await pool.minActivatingDeposit();
    const pendingValidatorsLimit = await pool.pendingValidatorsLimit();
    const effectiveValidators = await pool.effectiveValidators();
    const totalSLYX = await stakedLyxToken.totalSupply();

    return {
      rewardsBalance,
      poolBalance,
      depositBalance,
      swapSLYXBalance,
      totalPendingUnstake,
      totalClaimableUnstakes,
      totalUnstaked,
      unstakeProcessing,
      totalAvailableRewards,
      totalRewards,
      protocolFee,
      minActivatingDeposit,
      pendingValidatorsLimit,
      totalSLYX,
      effectiveValidators,
    };
  }

  logData(data) {
    console.clear();

    console.log(" --- PROTOCOL SUMMARY --- ");
    this.logCurrencySection(data, "LYX");
    this.logCurrencySection(data, "sLYX");
    this.logPercentageSection(data);
  }

  logCurrencySection(data, currency) {
    const section = currency === "LYX" ? "LYX BALANCES" : "sLYX BALANCES";
    console.log(`\n --- ${section} --- `);
    if (currency === "LYX") {
      console.log(`Rewards balance: ${formatEther(data.rewardsBalance)}${currency}`);
      console.log(`Pool balance: ${formatEther(data.poolBalance)}${currency}`);
      console.log(`Deposit balance: ${formatEther(data.depositBalance)}${currency}`);
      console.log(
        `Total available rewards: ${formatEther(data.totalAvailableRewards)}${currency}`
      );
      console.log(`Total rewards: ${formatEther(data.totalRewards)}${currency}`);
      console.log(`Min activating deposit: ${formatEther(data.minActivatingDeposit)}${currency}`);
    } else {
      console.log(`Swap balance: ${formatEther(data.swapSLYXBalance)}${currency}`);
      console.log(`Total pending unstake: ${formatEther(data.totalPendingUnstake)}${currency}`);
      console.log(
        `Total claimable unstakes: ${formatEther(data.totalClaimableUnstakes)}${currency}`
      );
      console.log(`Total unstaked: ${formatEther(data.totalUnstaked)}${currency}`);
      console.log(`Total SLYX: ${formatEther(data.totalSLYX)}${currency}`);
    }
  }

  logPercentageSection(data) {
    console.log("\n --- PERCENTAGES AND LIMITS --- ");
    console.log(`Protocol fee: ${data.protocolFee / 100}%`);
    console.log(`Unstake processing: ${data.unstakeProcessing}`);
    console.log(`Pending validators limit: ${data.pendingValidatorsLimit / 100}%`);
    console.log(
      `Current dilution percentage: ${
        (parseInt(formatEther(data.totalSLYX)) / (parseInt(data.effectiveValidators) * 32) - 1) *
        100
      }%`
    );
  }

  async setProtocolFee(fee) {
    const { rewards } = await getContracts();
    const { admin } = await getAccounts();
    await rewards.connect(admin).setProtocolFee(fee);
  }

  async setMinActivatingDeposit(amount) {
    const { pool } = await getContracts();
    const { admin } = await getAccounts();
    await pool.connect(admin).setMinActivatingDeposit(ethers.utils.parseEther(amount.toString()));
  }

  async setPendingValidatorsLimit(limit) {
    const { pool } = await getContracts();
    const { admin } = await getAccounts();
    await pool.connect(admin).setPendingValidatorsLimit(limit);
  }
}

module.exports = { Protocol };
