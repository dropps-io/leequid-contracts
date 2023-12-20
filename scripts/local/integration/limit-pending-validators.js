const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");

const { beforeTest } = require("./utils/before-test");

const { afterTest } = require("./utils/after-test");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { oraclesCronTimeoutInMs } = require("../config");
const { logMessage } = require("../utils/logging");
const { setValidatorsMock } = require("../utils/set-consensus-mock");
const { incrementBlocks } = require("../utils/increment-blocks");

const limitPendingValidatorsIntegration = async (debug = false) => {
  const { user1, user2, user3, user4, user5, admin } = await getAccounts();
  const { pool, rewards, stakedLyxToken } = await getContracts();

  try {
    console.log("⌛ Max pending validators - Integration test...");

    // Sync node
    await incrementBlocks(1, debug);

    await pool.connect(user5).stake({ value: ethers.utils.parseEther((32 * 100).toString()) });
    logMessage("user5 staked 3200 LYX, ⌛ waiting for oracles to register 100 validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    await setValidatorsMock([
      {
        amount: 100,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);

    logMessage("⌛ waiting for oracles to submit 100 activated validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    let activatedValidators = await pool.activatedValidators();
    expect(activatedValidators).to.equal(100);

    await pool.connect(admin).setPendingValidatorsLimit("2000");
    await pool.connect(admin).setMinActivatingDeposit("0");
    logMessage("Set pending validators limit to 20% & min activating deposit to 0", debug);

    await pool.connect(user1).stake({ value: ethers.utils.parseEther("160") });
    logMessage("user1 staked 160 LYX", debug);

    let user1SLyxBalance = await stakedLyxToken.balanceOf(user1.address);

    expect(user1SLyxBalance).to.equal(ethers.utils.parseEther("160"));

    await pool.connect(user2).stake({ value: ethers.utils.parseEther("640") });
    logMessage("user2 staked 640 LYX", debug);

    let user2SLyxBalance = await stakedLyxToken.balanceOf(user2.address);
    let user2Activation125 = await pool.activations(user2.address, 125);

    expect(user2SLyxBalance).to.equal(ethers.utils.parseEther("0"));
    expect(user2Activation125).to.equal(ethers.utils.parseEther("640"));

    await pool.connect(user3).stake({ value: ethers.utils.parseEther("480") });
    logMessage("user3 staked 480 LYX", debug);

    let user3SLyxBalance = await stakedLyxToken.balanceOf(user3.address);
    let user3Activation140 = await pool.activations(user3.address, 140);

    expect(user3SLyxBalance).to.equal(ethers.utils.parseEther("0"));
    expect(user3Activation140).to.equal(ethers.utils.parseEther("480"));

    await pool.connect(user4).stake({ value: ethers.utils.parseEther("10") });
    logMessage("user4 staked 10 LYX", debug);

    let user4SLyxBalance = await stakedLyxToken.balanceOf(user4.address);
    let user4Activation14 = await pool.activations(user4.address, 140);

    expect(user4SLyxBalance).to.equal(ethers.utils.parseEther("0"));
    expect(user4Activation14).to.equal(ethers.utils.parseEther("10"));

    logMessage("⌛ waiting for oracles to register 40 validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    await setValidatorsMock([
      {
        amount: 104,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 36,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "pending",
      },
    ]);

    logMessage("⌛ waiting for oracles to submit a total of 104 activated validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    activatedValidators = await pool.activatedValidators();
    expect(activatedValidators).to.equal(104);

    let canActivate125 = await pool.canActivate(125);
    let canActivate140 = await pool.canActivate(140);
    expect(canActivate125).to.equal(false);
    expect(canActivate140).to.equal(false);

    await setValidatorsMock([
      {
        amount: 105,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 35,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "pending",
      },
    ]);

    logMessage("⌛ waiting for oracles to submit a total of 105 activated validators", debug);
    await sleep(oraclesCronTimeoutInMs + 1000);

    activatedValidators = await pool.activatedValidators();
    expect(activatedValidators).to.equal(105);

    canActivate125 = await pool.canActivate(125);
    canActivate140 = await pool.canActivate(140);
    expect(canActivate125).to.equal(true);
    expect(canActivate140).to.equal(false);

    await pool.connect(user2).activate(user2.address, 125);
    logMessage("user2 activated index 125", debug);

    user2SLyxBalance = await stakedLyxToken.balanceOf(user2.address);
    expect(user2SLyxBalance).to.equal(ethers.utils.parseEther("640"));

    user2Activation125 = await pool.activations(user2.address, 125);
    expect(user2Activation125).to.equal(ethers.utils.parseEther("0"));

    await setValidatorsMock([
      {
        amount: 120,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
      {
        amount: 20,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "pending",
      },
    ]);

    logMessage("⌛ waiting for oracles to submit a total of 120 activated validators", debug);
    await sleep(oraclesCronTimeoutInMs + 3000);

    activatedValidators = await pool.activatedValidators();
    expect(activatedValidators).to.equal(120);

    canActivate140 = await pool.canActivate(140);
    expect(canActivate140).to.equal(true);

    await pool.connect(user4).activate(user4.address, 140);
    await pool.connect(user3).activate(user3.address, 140);
    logMessage("user4 and user3 activated index 140", debug);

    user4SLyxBalance = await stakedLyxToken.balanceOf(user4.address);
    user3SLyxBalance = await stakedLyxToken.balanceOf(user3.address);
    expect(user4SLyxBalance).to.equal(ethers.utils.parseEther("10"));
    expect(user3SLyxBalance).to.equal(ethers.utils.parseEther("480"));

    user4Activation14 = await pool.activations(user4.address, 140);
    let user3Activation14 = await pool.activations(user3.address, 140);
    expect(user4Activation14).to.equal(ethers.utils.parseEther("0"));
    expect(user3Activation14).to.equal(ethers.utils.parseEther("0"));

    await pool.connect(user2).stake({ value: ethers.utils.parseEther("100") });
    logMessage("user2 staked 100 LYX", debug);

    user2SLyxBalance = await stakedLyxToken.balanceOf(user2.address);
    expect(user2SLyxBalance).to.equal(ethers.utils.parseEther("740"));

    console.log("✅ Max pending validators - Success");
  } catch (e) {
    console.log("❌ Max pending validators - Failure");
    console.log(e);
  }
};

if (require.main === module) {
  beforeTest().then(() => limitPendingValidatorsIntegration(true).finally(() => afterTest()));
}

module.exports = { limitPendingValidatorsIntegration };
