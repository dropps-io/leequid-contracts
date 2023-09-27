const { getAccounts } = require("../utils/get-accounts");
const { getContracts } = require("../utils/get-contracts");
const { ethers, expect } = require("hardhat");
const { sleep } = require("../utils/sleep");
const { beforeTest } = require("./utils/before-test");
const { incrementBlocks } = require("../utils/increment-blocks");
const { oraclesCronTimeoutInMs } = require("../config");
const { setValidatorsMock, setExpectedWithdrawalsMock } = require("../utils/set-consensus-mock");
const { parseUnits } = require("ethers/lib/utils");
const { afterTest } = require("./utils/after-test");
const { logMessage } = require("../utils/logging");
const { retry } = require("../utils/retry");

const merkleDistributionHappyPath = async (debug) => {
  const { user1, user2, user3, user4, user5, admin } = await getAccounts();
  const { stakedLyxToken, pool, rewards, swapV1Mock, merkleDistributor, oracles } =
    await getContracts();

  console.log("⌛ Merkle Distribution - Integration test...");

  try {
    await rewards.connect(admin).setProtocolFee(0);
    logMessage("Protocol fee set to 0", debug);

    logMessage("Initalizing balances & approvals...", debug);
    await pool.connect(user1).stake({ value: ethers.utils.parseEther("3200") });
    await pool.connect(user2).stake({ value: ethers.utils.parseEther("3200") });
    await pool.connect(user3).stake({ value: ethers.utils.parseEther("3200") });
    await pool.connect(user4).stake({ value: ethers.utils.parseEther("3200") });
    await pool.connect(user5).stake({ value: ethers.utils.parseEther("3200") });
    await stakedLyxToken
      .connect(user1)
      .approve(swapV1Mock.address, ethers.utils.parseEther("3200"));
    await stakedLyxToken
      .connect(user2)
      .approve(swapV1Mock.address, ethers.utils.parseEther("3200"));
    await stakedLyxToken
      .connect(user3)
      .approve(swapV1Mock.address, ethers.utils.parseEther("3200"));
    await stakedLyxToken
      .connect(user4)
      .approve(swapV1Mock.address, ethers.utils.parseEther("3200"));
    await stakedLyxToken
      .connect(user5)
      .approve(swapV1Mock.address, ethers.utils.parseEther("3200"));
    logMessage("Balances & approvals initiated", debug);

    await setValidatorsMock([
      {
        amount: 500,
        withdrawalAddress: rewards.address,
        balance: "32000000000",
        slashed: false,
        status: "active_ongoing",
      },
    ]);

    logMessage("⌛ wait for oracles to register validators", debug);
    await sleep(oraclesCronTimeoutInMs * 2);
    await incrementBlocks(1, debug);

    await swapV1Mock.connect(user1).addLiquidity(ethers.utils.parseEther("2000"));
    logMessage("User1 added 2000 as liquidity", debug);

    await incrementBlocks(6, debug);

    await swapV1Mock.connect(user2).addLiquidity(ethers.utils.parseEther("2000"));
    logMessage("User2 added 2000 as liquidity", debug);

    let currentBlock = await ethers.provider.getBlockNumber();

    await setExpectedWithdrawalsMock(
      new Array(10).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("1", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );

    await incrementBlocks(6, debug);
    await sleep(oraclesCronTimeoutInMs * 1.5, debug);

    let event = await rewards.queryFilter("RewardsUpdated", currentBlock + 6);
    let rewardsUpdatedEvent = event[0].args;

    expect(rewardsUpdatedEvent.distributorReward).to.equal(
      ethers.utils.parseEther("2.5").toString()
    );

    event = await merkleDistributor.queryFilter("MerkleRootUpdated", currentBlock + 6);
    let merkleUpdatedEvent = event[event.length - 1].args;

    let distribution = await fetch(
      merkleUpdatedEvent.merkleProofs.replace("ipfs://", "https://ipfs.io/ipfs/")
    );
    distribution = await distribution.json();

    expect(distribution.distribution[user1.address].values[0]).to.equal(
      ethers.utils.parseEther("1.25").toString()
    );
    expect(distribution.distribution[user2.address].values[0]).to.equal(
      ethers.utils.parseEther("1.25").toString()
    );

    await claimAndVerify(user1, distribution.distribution[user1.address], debug);

    logMessage("Set new Oracles address in MerkleDistributor (lock merkle updates)", debug);
    await merkleDistributor.connect(admin).setOracles(admin.address);

    currentBlock = await ethers.provider.getBlockNumber();

    await setExpectedWithdrawalsMock(
      new Array(10).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("1", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );

    await incrementBlocks(12, debug);
    await sleep(oraclesCronTimeoutInMs * 1.5, debug);

    event = await rewards.queryFilter("RewardsUpdated", currentBlock + 12);
    rewardsUpdatedEvent = event[0].args;

    expect(rewardsUpdatedEvent.distributorReward).to.equal(
      ethers.utils.parseEther("2.5").toString()
    );

    await incrementBlocks(6, debug);

    await swapV1Mock.connect(user1).addLiquidity(ethers.utils.parseEther("1200"));
    logMessage("User1 added 1200 as liquidity", debug);

    currentBlock = await ethers.provider.getBlockNumber();

    await setExpectedWithdrawalsMock(
      new Array(10).fill({
        address: rewards.address.toLowerCase(),
        amount: parseUnits("1", "gwei").toString(),
      }),
      (currentBlock + 2).toString()
    );

    await merkleDistributor.connect(admin).setOracles(oracles.address);
    logMessage(
      "Set Oracles address in MerkleDistributor to Oracles contract (unlocking merkle update)",
      debug
    );

    await incrementBlocks(6, debug);
    await sleep(oraclesCronTimeoutInMs * 2, debug);

    event = await rewards.queryFilter("RewardsUpdated", currentBlock + 6);
    rewardsUpdatedEvent = event[0].args;

    expect(rewardsUpdatedEvent.distributorReward).to.equal(
      ethers.utils.parseEther("3.25").toString()
    );

    event = await merkleDistributor.queryFilter("MerkleRootUpdated", currentBlock + 6);
    merkleUpdatedEvent = event[event.length - 1].args;

    distribution = await fetch(
      merkleUpdatedEvent.merkleProofs.replace("ipfs://", "https://ipfs.io/ipfs/")
    );
    distribution = await distribution.json();

    expect(distribution.distribution[user1.address].values[0]).to.equal(
      ethers.utils.parseEther("3.24999995").toString()
    );
    expect(distribution.distribution[user2.address].values[0]).to.equal(
      ethers.utils.parseEther("3.749999725").toString()
    );

    logMessage("User2 removes his liquidity", debug);
    await swapV1Mock.connect(user2).removeLiquidity(ethers.utils.parseEther("2000"));

    logMessage("User3 add 1000 as liquidity", debug);
    await swapV1Mock.connect(user3).addLiquidity(ethers.utils.parseEther("1000"));

    await incrementBlocks(11);

    logMessage("User4 add 3200 as liquidity", debug);
    await swapV1Mock.connect(user4).addLiquidity(ethers.utils.parseEther("3200"));

    distribution = await submitAndVerifyDistribution(
      8,
      "3.7",
      [
        { address: user1.address, amount: "4.84999983" },
        { address: user2.address, amount: "3.749999725" },
        { address: user3.address, amount: "0.49999987" },
        { address: user4.address, amount: "1.59999988" },
      ],
      debug
    );

    await claimAndVerify(user1, distribution.distribution[user1.address], debug);

    await claimAndVerify(user2, distribution.distribution[user2.address], debug);

    logMessage("User1 removes his liquidity", debug);
    await swapV1Mock.connect(user1).removeLiquidity(ethers.utils.parseEther("3200"));

    logMessage("User3 removes his liquidity", debug);
    await swapV1Mock.connect(user3).removeLiquidity(ethers.utils.parseEther("1000"));

    logMessage("User5 add 2000 as liquidity", debug);
    await swapV1Mock.connect(user5).addLiquidity(ethers.utils.parseEther("2000"));

    await submitAndVerifyDistribution(
      9,
      "2.925",
      [
        { address: user1.address, amount: "0" },
        { address: user2.address, amount: "0" },
        { address: user3.address, amount: "0.49999987" },
        { address: user4.address, amount: "3.399999835" },
        { address: user5.address, amount: "1.1249997525" },
      ],
      debug
    );

    await console.log("✅ Merkle Distribution - Success");
  } catch (e) {
    console.log("❌ Merkle Distribution - Failure");
    console.log(e);
  }
};

async function claimAndVerify(user, distribution, debug) {
  const { rewards, merkleDistributor } = await getContracts();
  let userRewardsBefore = await rewards.balanceOf(user.address);

  logMessage(`User claims his rewards`, debug);
  await retry(
    async () =>
      await merkleDistributor
        .connect(user)
        .claim(
          distribution.index,
          user.address,
          distribution.tokens,
          distribution.values,
          distribution.proof
        ),
    debug
  );

  let userRewardsAfter = await rewards.balanceOf(user.address);

  expect(userRewardsAfter.sub(userRewardsBefore)).to.equal(distribution.values[0]);
}

async function submitAndVerifyDistribution(
  rewardsInLyx,
  expectedDistributorReward,
  expectedDistribution,
  debug
) {
  const { rewards, merkleDistributor } = await getContracts();
  const currentBlock = await ethers.provider.getBlockNumber();

  await setExpectedWithdrawalsMock(
    new Array(rewardsInLyx).fill({
      address: rewards.address.toLowerCase(),
      amount: parseUnits("1", "gwei").toString(),
    }),
    (currentBlock + 2).toString()
  );

  await incrementBlocks(12, debug);
  await sleep(oraclesCronTimeoutInMs * 2, debug);

  const rewardsEvents = await rewards.queryFilter("RewardsUpdated", currentBlock + 12);
  const rewardsUpdatedEvent = rewardsEvents[0].args;

  expect(rewardsUpdatedEvent.distributorReward).to.equal(
    ethers.utils.parseEther(expectedDistributorReward).toString()
  );

  const merkleEvents = await merkleDistributor.queryFilter("MerkleRootUpdated", currentBlock + 6);
  const merkleUpdatedEvent = merkleEvents[merkleEvents.length - 1].args;

  const res = await fetch(
    merkleUpdatedEvent.merkleProofs.replace("ipfs://", "https://ipfs.io/ipfs/")
  );
  const distribution = await res.json();

  expectedDistribution.forEach(({ address, amount }) => {
    expect(distribution.distribution[address].values[0]).to.equal(
      ethers.utils.parseEther(amount).toString()
    );
  });

  return distribution;
}

if (require.main === module) {
  beforeTest().then(() => merkleDistributionHappyPath(true).finally(() => afterTest()));
}

module.exports = { merkleDistributionHappyPath };
