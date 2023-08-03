const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");

const { beforeTest } = require("./utils/before-test");

const { afterTest } = require("./utils/after-test");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { oraclesCronTimeoutInMs } = require("../config");

const oraclesDownIntegration = async () => {
  const { user1, user2, admin } = await getAccounts();
  const { pool, oracles } = await getContracts();

  try {
    console.log("⌛ Oracles down - Integration test...");

    // Adding one address to oracles without running it
    await oracles.connect(admin).addOracle(user1.address);

    await pool.connect(user2).stake({ value: ethers.utils.parseEther("32") });

    await sleep(oraclesCronTimeoutInMs + 1000);

    // Check if transaction went through
    let poolBalance = await ethers.provider.getBalance(pool.address);
    expect(poolBalance).to.equal(ethers.utils.parseEther("0"));

    await pool.connect(user2).stake({ value: ethers.utils.parseEther("32") });

    await sleep(oraclesCronTimeoutInMs + 1000);

    // Check if transaction went through
    poolBalance = await ethers.provider.getBalance(pool.address);
    expect(poolBalance).to.equal(ethers.utils.parseEther("32"));

    console.log("✅ Oracles down - Success");
  } catch (e) {
    console.log("❌ Oracles down - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => oraclesDownIntegration().finally(() => afterTest()));
}

module.exports = { oraclesDownIntegration };
