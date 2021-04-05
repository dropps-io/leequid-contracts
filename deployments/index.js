const hre = require('hardhat');
const { deployPoolEscrow } = require('./collectors');
const { white, green } = require('chalk');
const { contractSettings, contracts } = require('./settings');
const { deployAndInitializeStakeWiseToken } = require('./tokens');
const {
  deployVestingEscrow,
  deployAndInitializeVestingEscrowFactory,
} = require('./vestings');

function log(message) {
  if (hre.config != null && hre.config.suppressLogs !== true) {
    console.log(message);
  }
}

async function prepareContractsUpgrades() {
  log(white('Nothing to prepare...'));
}

async function upgradeContracts() {
  let stakeWiseTokenContractAddress = await deployAndInitializeStakeWiseToken(
    contractSettings.admin
  );
  log(
    white(
      `Deployed StakeWise token contract: ${green(
        stakeWiseTokenContractAddress
      )}`
    )
  );

  let vestingEscrowContractAddress = await deployVestingEscrow();
  log(
    white(
      `Deployed VestingEscrow contract: ${green(vestingEscrowContractAddress)}`
    )
  );

  let vestingEscrowFactoryContractAddress = await deployAndInitializeVestingEscrowFactory(
    contractSettings.admin,
    vestingEscrowContractAddress
  );
  log(
    white(
      `Deployed VestingEscrow Factory contract: ${green(
        vestingEscrowFactoryContractAddress
      )}`
    )
  );

  let poolEscrowContractAddress = await deployPoolEscrow(
    contractSettings.admin
  );
  log(
    white(`Deployed PoolEscrow contract: ${green(poolEscrowContractAddress)}`)
  );

  return {
    ...contracts,
    vestingEscrowFactory: vestingEscrowFactoryContractAddress,
    vestingEscrow: vestingEscrowContractAddress,
    poolEscrow: poolEscrowContractAddress,
    stakeWiseToken: stakeWiseTokenContractAddress,
  };
}

module.exports = {
  prepareContractsUpgrades,
  upgradeContracts,
};
