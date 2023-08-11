const { ethers } = require("hardhat");
const { getContracts } = require("../utils/get-contracts");
const { formatEther, parseEther, parseUnits } = require("ethers/lib/utils");
const { beforeTest } = require("../integration/utils/before-test");
const {
  setFinalityCheckpointsMock,
  setValidatorsMock,
  setExpectedWithdrawalsMock,
} = require("../utils/set-consensus-mock");
const { getAccounts } = require("../utils/get-accounts");
const { generateRandomEthAddress } = require("../utils/random-address");

class MockChain {
  constructor() {
    this.intervalId = null;
    this.processedUnstakeEvents = [];
    this.registeredValidators = 0;
    this.activatedValidators = 0;
    this.exitedValidators = 0;
    this.totalWithdrawals = BigInt(0);
    this.rewardsEnabled = true;
    this.latestProcessedBlock = 0;
  }

  isRunning() {
    return this.intervalId !== null;
  }

  async initialize() {
    await beforeTest();
    console.log(`MockChain initialized`);
  }

  async start() {
    this.intervalId = setInterval(() => {
      this.processBlock();
    }, 2500);
    console.log(`MockChain started`);
  }

  async stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`MockChain stopped`);
    }
  }

  async processBlock() {
    const blockNumber = await this.getData();

    if (blockNumber <= this.latestProcessedBlock) return;

    this.logData(blockNumber);

    let validatorsToExit = 0;

    if (blockNumber % 20 === 0) {
      await setFinalityCheckpointsMock({ finalized: { epoch: "30000" } });
      validatorsToExit = await this.fetchValidatorsToExit();
    }

    this.exitedValidators += validatorsToExit;

    await this.postValidators();

    await this.postRandomWithdrawals(blockNumber + 2, validatorsToExit);

    this.latestProcessedBlock = blockNumber;
  }

  async getData() {
    const { mockBeacon } = await getContracts();

    const currentBlock = await ethers.provider.getBlockNumber();
    this.registeredValidators = (await mockBeacon.queryFilter("DepositEvent")).length;

    return currentBlock;
  }

  logData(blockNumber) {
    console.clear();
    console.log(" --- MOCKCHAIN --- ");
    console.log(`Block: ${blockNumber}`);
    console.log(`Effective validators: ${this.activatedValidators - this.exitedValidators}`);
    console.log(`Exited validators: ${this.exitedValidators}`);
    console.log(`Registered validators: ${this.registeredValidators}`);
    console.log(`Total withdrawals: ${formatEther(this.totalWithdrawals)}LYX`);
  }

  async fetchValidatorsToExit() {
    const { stakedLyxToken } = await getContracts();

    const unstakeReady = await stakedLyxToken.queryFilter("UnstakeReady");
    if (unstakeReady.length === 0) return 0;
    else {
      if (
        this.processedUnstakeEvents.includes(unstakeReady[unstakeReady.length - 1].transactionHash)
      )
        return 0;
      else {
        this.processedUnstakeEvents.push(unstakeReady[unstakeReady.length - 1].transactionHash);
        return parseInt(unstakeReady[unstakeReady.length - 1].args["validatorsToExit"]);
      }
    }
  }

  async postValidators() {
    const { rewards } = await getContracts();

    const validatorsToActivate = Math.ceil(
      Math.random() * (this.registeredValidators - this.activatedValidators)
    );
    this.activatedValidators += validatorsToActivate;
    const pendingValidators = this.registeredValidators - this.activatedValidators;

    await setValidatorsMock([
      {
        amount: this.activatedValidators - this.exitedValidators,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: pendingValidators,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "pending",
      },
      {
        amount: this.exitedValidators,
        withdrawalAddress: rewards.address,
        balance: "0",
        slashed: false,
        status: "withdrawal_done",
      },
    ]);
  }

  async postRandomWithdrawals(block, validatorsToExit) {
    const { rewards } = await getContracts();
    const { chain, admin } = await getAccounts();

    let randomWithdrawals = [];
    const maxWithdrawals = Math.floor(block / 1000) * 10 + 10;
    const numberOfWithdrawals = Math.floor(Math.random() * maxWithdrawals) + 1;

    let protocolTotalWithdrawals = BigInt(0);
    let protocolWithdrawals = 0;

    for (let i = 0; i < numberOfWithdrawals; i++) {
      const randomAddress =
        Math.random() > 0.7 &&
        protocolWithdrawals < this.activatedValidators - this.exitedValidators &&
        this.rewardsEnabled
          ? rewards.address.toLowerCase()
          : generateRandomEthAddress().toLowerCase();
      const randomAmount = (Math.random() * 0.05).toFixed(6).toString();

      if (randomAddress === rewards.address.toLowerCase()) {
        protocolTotalWithdrawals += BigInt(parseEther(randomAmount).toString());
        protocolWithdrawals++;
      }

      randomWithdrawals.push({
        address: randomAddress,
        amount: parseUnits(randomAmount, "gwei").toString(),
      });
    }

    if (validatorsToExit > 0) {
      await admin.sendTransaction({
        to: rewards.address,
        value: BigInt(parseEther((32 * validatorsToExit).toString()).toString()),
      });

      randomWithdrawals = randomWithdrawals.concat(
        new Array(validatorsToExit).fill({
          address: rewards.address.toLowerCase(),
          amount: parseUnits("32", "gwei").toString(),
        })
      );
    }

    await chain.sendTransaction({
      to: rewards.address,
      value: protocolTotalWithdrawals.toString(),
    });

    await setExpectedWithdrawalsMock(randomWithdrawals, block);
    this.totalWithdrawals += protocolTotalWithdrawals;
  }
}

module.exports = { MockChain };
