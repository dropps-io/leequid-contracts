const { ethers } = require("hardhat");
const fs = require("fs");
const deployedAddresses = JSON.parse(fs.readFileSync("local_addresses.json", "utf8"));

const getContracts = async () => {
  let mockBeacon, rewards, stakedLyxToken, pool, poolValidators, merkleDistributor, oracles;

  const MockBeacon = await ethers.getContractFactory("DepositContract");
  mockBeacon = MockBeacon.attach(deployedAddresses.deposit);

  const Rewards = await ethers.getContractFactory("Rewards");
  rewards = Rewards.attach(deployedAddresses.rewards);

  const StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
  stakedLyxToken = StakedLyxToken.attach(deployedAddresses.stakedLyxToken);

  const Pool = await ethers.getContractFactory("Pool");
  pool = Pool.attach(deployedAddresses.pool);

  const PoolValidators = await ethers.getContractFactory("PoolValidators");
  poolValidators = PoolValidators.attach(deployedAddresses.poolValidators);

  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  merkleDistributor = MerkleDistributor.attach(deployedAddresses.merkleDistributor);

  const Oracles = await ethers.getContractFactory("Oracles");
  oracles = Oracles.attach(deployedAddresses.oracles);
  return {
    mockBeacon,
    rewards,
    stakedLyxToken,
    pool,
    poolValidators,
    merkleDistributor,
    oracles,
  };
};

module.exports = { getContracts };
