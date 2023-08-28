const { Wallet } = require("ethers");
const { ethers } = require("hardhat");
const { getContracts } = require("../utils/get-contracts");
const { formatEther } = require("ethers/lib/utils");

class AutonomousUser {
  constructor(
    staking = true,
    unstaking = true,
    addingLiquidity = true,
    cashingOut = true,
    compounding = true,
    chancesOfMalicious = 0.01
  ) {
    this.wallet = Wallet.createRandom();
    this.wallet = this.wallet.connect(ethers.provider);
    this.intervalId = null;
    this.merkleDistributions = {};
    this.isLiquidityProvider = false;
    this.staking = staking;
    this.unstaking = unstaking;
    this.cashingOut = cashingOut;
    this.compouding = compounding;
    this.unstaking = unstaking;
    this.addingLiquidity = addingLiquidity;
    this.maliciousChances = chancesOfMalicious;

    this.totalStaked = BigInt(0);
    this.totalUnstaked = BigInt(0);
    this.unstakeRequests = [];
    this.pendingActivation = [];
  }

  // Method to retrieve the address of the user
  getAddress() {
    return this.wallet.address;
  }

  isActivated() {
    return this.intervalId !== null;
  }

  activate() {
    if (this.intervalId !== null) {
      return;
    }

    console.log(`Activating user ${this.getAddress()}`);

    this.intervalId = setInterval(() => {
      this.randomAction();
    }, Math.random() * 1199000 + 1000); // Random intervals between 1s and 20 minutes
  }

  // Function to disable the random actions
  disable() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`Deactivating user ${this.getAddress()}`);
    }
  }

  async exit() {
    this.disable();

    const { stakedLyxToken, swapV1Mock, rewards } = await getContracts();
    const balanceSLYX = await stakedLyxToken.balanceOf(this.getAddress());
    const liquidity = await swapV1Mock.balanceOf(this.getAddress());
    const rewardsAmount = await rewards.balanceOf(this.getAddress());

    if (this.pendingActivation.length > 0) await this.activateStakes(false);
    if (this.unstakeRequests.length > 0) await this.claimUnstake(this.unstakeRequests);
    if (!liquidity.isZero()) await this.removeLiquidity(liquidity);
    if (!balanceSLYX.isZero()) await this.unstake(balanceSLYX);
    await this.fetchAndClaimMerkleRewards();

    if (!rewardsAmount.isZero()) await this.cashOutRewards(rewardsAmount);
  }

  async claimAndCashoutRewards(compound = false) {
    const { rewards } = await getContracts();

    await this.fetchAndClaimMerkleRewards();
    const rewardsAmount = await rewards.balanceOf(this.getAddress());

    if (!rewardsAmount.isZero()) {
      if (compound) await this.compoundRewards(rewardsAmount);
      else await this.cashOutRewards(rewardsAmount);
    }
  }

  async randomAction() {
    const { stakedLyxToken, swapV1Mock, rewards } = await getContracts();
    const balanceLYX = await ethers.provider.getBalance(this.getAddress());
    const balanceSLYX = await stakedLyxToken.balanceOf(this.getAddress());
    const liquidity = await swapV1Mock.balanceOf(this.getAddress());
    const rewardsAmount = await rewards.balanceOf(this.getAddress());

    const isMalicious = Math.random() < this.maliciousChances;

    const actions = [
      async () => this.stake(this.randomBigNumber(balanceLYX, !isMalicious), isMalicious),
      async () => this.unstake(this.randomBigNumber(balanceSLYX, !isMalicious), isMalicious),
      async () => this.addLiquidity(this.randomBigNumber(balanceSLYX, !isMalicious), isMalicious),
      async () => this.removeLiquidity(this.randomBigNumber(liquidity, !isMalicious), isMalicious),
      async () =>
        this.cashOutRewards(this.randomBigNumber(rewardsAmount, !isMalicious), isMalicious),
      async () =>
        this.compoundRewards(this.randomBigNumber(rewardsAmount, !isMalicious), isMalicious),
      async () => this.fetchAndClaimMerkleRewards(isMalicious),
      async () => this.activateStakes(isMalicious),
    ];

    // Default ratios for actions (you can modify these as per your needs)
    let ratios = [10, 1, 5, 1, 5, 5, 5, 1000];

    if (!isMalicious) {
      if (balanceLYX.isZero() || !this.staking) ratios[0] = 0;
      if (balanceSLYX.isZero() || !this.unstaking) ratios[1] = 0;
      if (balanceSLYX.isZero() || !this.addingLiquidity) ratios[2] = 0;
      if (liquidity.isZero()) ratios[3] = 0;
      if (rewardsAmount.isZero() || !this.cashingOut) ratios[4] = 0;
      if (rewardsAmount.isZero() || !this.compouding) ratios[5] = 0;
      if (!this.isLiquidityProvider) ratios[6] = 0;
      if (this.pendingActivation.length === 0) ratios[7] = 0;
    } else {
      actions.push(async () => this.claimUnstake([Math.ceil(Math.random() * 1000)], true));
      ratios.push(5);
    }

    if (ratios.every((r) => r === 0)) return;

    // Normalize ratios to sum to 1
    const sum = ratios.reduce((acc, val) => acc + val, 0);
    ratios = ratios.map((r) => r / sum);

    // Select an action based on the modified ratios
    let r = Math.random();
    let accumulatedRatio = 0;
    let actionIndex = -1;

    for (let i = 0; i < ratios.length; i++) {
      accumulatedRatio += ratios[i];
      if (r <= accumulatedRatio) {
        actionIndex = i;
        break;
      }
    }

    // If for some reason no action is selected (all ratios are 0), default to the first action
    if (actionIndex === -1) actionIndex = 0;

    await actions[actionIndex]();
  }

  randomBigNumber(number, isMax) {
    let value = parseFloat(ethers.utils.formatEther(number));
    if (value === 0 && !isMax) value = 50;
    else if (value <= 1) return number;

    let resultValue;
    if (isMax) {
      resultValue = 1 + Math.random() * (value - 1);
    } else {
      resultValue = value + Math.random() * value;
    }

    return ethers.utils.parseEther(resultValue.toString());
  }

  async stake(amount, isMalicious) {
    const { pool } = await getContracts();

    if (parseInt(formatEther(amount)) < 1) return;

    try {
      const receipt = await pool.connect(this.wallet).stake({ value: amount });
      const txReceipt = await receipt.wait(); // Wait for the transaction receipt

      const eventLog = txReceipt.events.find((log) => log.event === "ActivationScheduled");

      // Parse the log using the interface
      if (eventLog) {
        const validatorIndex = eventLog.args[1];
        this.pendingActivation.push(validatorIndex);
      }
      this.totalStaked = this.totalStaked + BigInt(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} staked ${ethers.utils
          .formatEther(amount)
          .toString()} LYX`
      );
    } catch (e) {
      console.warn(
        `${isMalicious ? "😈" : ""} ❌ ${this.getAddress()} failed to stake ${ethers.utils
          .formatEther(amount)
          .toString()} LYX`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async unstake(amount, isMalicious) {
    const { stakedLyxToken } = await getContracts();

    try {
      const receipt = await stakedLyxToken.connect(this.wallet).unstake(amount);
      const txReceipt = await receipt.wait(); // Wait for the transaction receipt

      // Find the log for the specific event
      const eventLog = txReceipt.events.find((log) => log.event === "NewUnstakeRequest");

      // Parse the log using the interface
      if (eventLog) {
        const requestIndex = eventLog.args[0];
        this.unstakeRequests.push(requestIndex);
      } else {
        console.warn("NewUnstakeRequest event not found in the transaction receipt");
      }

      this.totalUnstaked = this.totalUnstaked + BigInt(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} unstaked ${ethers.utils
          .formatEther(amount)
          .toString()} SLYX`
      );
    } catch (e) {
      console.warn(
        `${isMalicious ? "😈" : ""} ❌ ${this.getAddress()} failed to unstake ${ethers.utils
          .formatEther(amount)
          .toString()} SLYX`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async addLiquidity(amount, isMalicious) {
    const { stakedLyxToken, swapV1Mock } = await getContracts();

    try {
      await stakedLyxToken.connect(this.wallet).approve(swapV1Mock.address, amount);
      await swapV1Mock.connect(this.wallet).addLiquidity(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} added ${ethers.utils
          .formatEther(amount)
          .toString()} to the liquidity pool`
      );
      this.isLiquidityProvider = true;
    } catch (e) {
      console.warn(
        `${isMalicious ? "😈" : ""} ❌ ${this.getAddress()} failed to add ${ethers.utils
          .formatEther(amount)
          .toString()} to the liquidity pool`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async removeLiquidity(amount, isMalicious) {
    const { swapV1Mock } = await getContracts();
    try {
      await swapV1Mock.connect(this.wallet).removeLiquidity(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} removed ${ethers.utils
          .formatEther(amount)
          .toString()} from the liquidity pool`
      );
    } catch (e) {
      console.warn(
        `${isMalicious ? "😈" : ""} ❌ ${this.getAddress()} failed to remove ${ethers.utils
          .formatEther(amount)
          .toString()} from the liquidity pool`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async claimUnstake(requestIndexes, isMalicious) {
    const { rewards } = await getContracts();
    try {
      await rewards.connect(this.wallet).claimUnstake(requestIndexes);
      this.unstakeRequests = this.unstakeRequests.filter(
        (requestIndex) => !requestIndexes.includes(requestIndex)
      );
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} claimed unstakes ${requestIndexes.join(
          ", "
        )}`
      );
    } catch (e) {
      console.warn(
        `${
          isMalicious ? "😈" : ""
        } ❌ ${this.getAddress()} failed to claim unstakes ${requestIndexes.join(", ")}`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async cashOutRewards(amount, isMalicious) {
    const { rewards } = await getContracts();
    try {
      await rewards.connect(this.wallet).cashOutRewards(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} cashed out rewards ${ethers.utils
          .formatEther(amount)
          .toString()}LYX`
      );
    } catch (e) {
      console.warn(
        `${
          isMalicious ? "😈" : ""
        } ❌ ${this.getAddress()} failed to cash out rewards ${ethers.utils
          .formatEther(amount)
          .toString()}LYX`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async compoundRewards(amount, isMalicious) {
    const { rewards } = await getContracts();
    try {
      await rewards.connect(this.wallet).compoundRewards(amount);
      console.log(
        `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} compounded rewards ${ethers.utils
          .formatEther(amount)
          .toString()}LYX`
      );
    } catch (e) {
      console.warn(
        `${
          isMalicious ? "😈" : ""
        } ❌ ${this.getAddress()} failed to compound rewards ${ethers.utils
          .formatEther(amount)
          .toString()}LYX`
      );
      if (!isMalicious) console.error(e);
    }
  }

  async fetchAndClaimMerkleRewards(isMalicious = false) {
    const distribution = await this.fetchLatestMerkleDistribution();
    if (distribution) {
      await this.claimMerkleRewards(
        distribution.index,
        distribution.tokens,
        distribution.values,
        distribution.proof,
        isMalicious
      );
    }
  }

  async claimMerkleRewards(index, tokens, amounts, merkleProofs, isMalicious) {
    const { merkleDistributor } = await getContracts();
    if (amounts.length === 0 || amounts[0] === "0") {
      console.log(`✅ ${this.getAddress()} has no merkle rewards to claim`);
      return;
    }
    try {
      await merkleDistributor
        .connect(this.wallet)
        .claim(index, this.getAddress(), tokens, amounts, merkleProofs);
      console.log(`✅ ${this.getAddress()} claimed merkle rewards ${amounts.join(", ")}`);
    } catch (e) {
      console.warn(`❌ ${this.getAddress()} failed to claim merkle rewards ${amounts.join(", ")}`);
      if (!isMalicious) console.error(e);
    }
  }

  async fetchLatestMerkleDistribution() {
    try {
      const { merkleDistributor } = await getContracts();
      const currentBlock = await ethers.provider.getBlockNumber();

      const merkleEvents = await merkleDistributor.queryFilter(
        "MerkleRootUpdated",
        currentBlock - 1000 > 0 ? currentBlock - 1000 : 1
      );

      if (merkleEvents.length === 0) return null;

      const merkleUpdatedEvent = merkleEvents[merkleEvents.length - 1].args;

      if (this.merkleDistributions[merkleUpdatedEvent.merkleRoot]) {
        return this.merkleDistributions[merkleUpdatedEvent.merkleRoot].distribution[
          this.getAddress()
        ];
      }

      const res = await fetch(
        merkleUpdatedEvent.merkleProofs.replace("ipfs://", "https://2eff.lukso.dev/ipfs/")
      );
      const distribution = await res.json();

      this.merkleDistributions[merkleUpdatedEvent.merkleRoot] = distribution;

      if (distribution.distribution[this.getAddress()])
        return distribution.distribution[this.getAddress()];
      else return null;
    } catch (e) {
      console.warn(`❌ ${this.getAddress()} failed to fetch the latest merkle distribution`);
      console.error(e);
    }
  }

  async activateStakes(isMalicious) {
    const { pool } = await getContracts();
    try {
      const toActivate = [];
      if (isMalicious) {
        toActivate.push(Math.ceil(Math.random() * 1000));
      } else {
        for (let i = 0; i < this.pendingActivation.length; i++) {
          if (await pool.canActivate(this.pendingActivation[i])) {
            toActivate.push(this.pendingActivation[i]);
          }
        }
      }
      await pool.connect(this.wallet).activateMultiple(this.getAddress(), toActivate);
      this.pendingActivation = this.pendingActivation.filter(
        (requestIndex) => !toActivate.includes(requestIndex)
      );
      if (toActivate.length > 0) {
        console.log(
          `${isMalicious ? "😈" : ""} ✅ ${this.getAddress()} activated stakes ${toActivate.join(
            ", "
          )}`
        );
      }
    } catch (e) {
      console.warn(`${isMalicious ? "😈" : ""} ❌ ${this.getAddress()} failed to activate`);
      if (!isMalicious) console.error(e);
    }
  }

  async status() {
    const { stakedLyxToken } = await getContracts();

    const balanceSLYX = await stakedLyxToken.balanceOf(this.getAddress());

    console.log(`--- User ${this.getAddress()} ---`);
    console.log(`Total staked: ${ethers.utils.formatEther(this.totalStaked).toString()} LYX`);
    console.log(`Total unstaked: ${ethers.utils.formatEther(this.totalUnstaked).toString()} LYX`);
    console.log(`${this.pendingActivation.length} pending activation`);
    console.log(`${this.unstakeRequests.length} pending unstake requests`);

    console.log(`sLYX balance: ${ethers.utils.formatEther(balanceSLYX).toString()} sLYX`);
  }
}

module.exports = { AutonomousUser };
