const { AutonomousUser } = require("./User.class");
const { parseEther } = require("ethers/lib/utils");
const { getAccounts } = require("../utils/get-accounts");

class Users {
  constructor() {
    this.intervalId = null;
    this.users = [];
    this.maxUsers = 100;
    this.minUsersBeforeExitings = 25;
    this.exitAllWhenMaxUsersReached = true;
    this.exitAllWhenMaxUsersReachedInterval = 11 * 60 * 1000;
    this.intervalTime = 20000;
    this.chancesOfExiting = 0.3;
    this.chancesOfMalicious = 0.01;
    this.staking = true;
    this.unstaking = true;
    this.addingLiquidity = true;
    this.cashingOut = true;
    this.compouding = true;
  }

  start() {
    this.intervalId = setInterval(async () => this.intervalAction(), this.intervalTime);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async intervalAction() {
    if (this.users.length < this.maxUsers) {
      await this.newUser();
    } else if (this.exitAllWhenMaxUsersReached) {
      await this.exitAllUsers();
      this.intervalTime = this.exitAllWhenMaxUsersReachedInterval;
      return;
    }

    if (this.users.length > this.minUsersBeforeExitings && Math.random() < this.chancesOfExiting) {
      const randomUserIndex = Math.floor(Math.random() * this.users.length);
      await this.users[randomUserIndex].exit();
    }
  }

  isRunning() {
    return this.intervalId !== null;
  }

  async newUser() {
    const { chain } = await getAccounts();

    const newUser = new AutonomousUser(
      this.staking,
      this.unstaking,
      this.addingLiquidity,
      this.cashingOut,
      this.compouding,
      this.chancesOfMalicious
    );
    await chain.sendTransaction({
      to: newUser.getAddress(),
      value: parseEther((Math.random() * 900 + 100).toString()),
    });
    await newUser.activate();
    this.users.push(newUser);

    console.log(`New user created. Total users: ${this.users.length}`);
  }

  async exitAllUsers() {
    for (const user of this.users) {
      await user.exit();
    }
  }

  async activateAllUsers() {
    for (const user of this.users) {
      await user.activate();
    }
  }

  async disableAllUsers() {
    for (const user of this.users) {
      await user.disable();
    }
  }

  async claimAndCashoutAllRewards(compound = false) {
    for (const user of this.users) {
      await user.claimAndCashoutRewards(compound);
    }
  }

  stakingEnable(enable = true) {
    this.staking = enable;
    for (const user of this.users) {
      user.staking = enable;
    }
  }

  unstakingEnable(enable = true) {
    this.unstaking = enable;
    for (const user of this.users) {
      user.unstaking = enable;
    }
  }

  addingLiquidityEnable(enable = true) {
    this.addingLiquidity = enable;
    for (const user of this.users) {
      user.addingLiquidity = enable;
    }
  }

  async setProperty(property, value) {
    if (this[property] !== undefined) {
      this[property] = value;
    } else {
      console.log(`Invalid property: ${property}`);
    }
  }

  async usersStatus() {
    for (const user of this.users) {
      await user.status();
    }
  }
}

module.exports = { Users };
