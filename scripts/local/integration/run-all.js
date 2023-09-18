const { stakingHappyPath } = require("./staking");
const { beforeTest } = require("./utils/before-test");
const { unstakingHappyPath } = require("./unstaking");
const { oraclesDownIntegration } = require("./oracles-down");
const { unstakeMatching } = require("./unstake-matching");
const { validatorsPenalizedIntegration } = require("./validators-penalized");
const { limitPendingValidatorsIntegration } = require("./limit-pending-validators");
const { merkleDistributionHappyPath } = require("./merkle-distribution");
const { chaoticStakingTest } = require("./chaotic-testing");
const { afterTest } = require("./utils/after-test");
const { rewardsSubmissionHappyPath } = require("./rewards-submission");

async function runAll() {
  await beforeTest();
  await stakingHappyPath();
  await beforeTest();
  await unstakingHappyPath();
  await beforeTest();
  await oraclesDownIntegration();
  await beforeTest();
  await unstakeMatching();
  await beforeTest();
  await validatorsPenalizedIntegration();
  await beforeTest();
  await limitPendingValidatorsIntegration();
  await beforeTest();
  await rewardsSubmissionHappyPath();
  await beforeTest();
  await merkleDistributionHappyPath();
  await beforeTest();
  await chaoticStakingTest();
  await afterTest();
}

runAll();
