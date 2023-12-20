const { ethers } = require("hardhat");

async function main() {
  const currentGasPrice = await ethers.provider.getGasPrice();
  const args = {
    gasPrice: currentGasPrice.toHexString(),
  };

  console.log("deploying Rewards...");
  const Rewards = await ethers.getContractFactory("Rewards");
  const rewards = await Rewards.deploy(args);
  await rewards.deployed();
  console.log("Rewards implementation deployed to:", rewards.address);

  console.log("deploying StakedLyxToken...");
  const StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
  const stakedLyxToken = await StakedLyxToken.deploy(args);
  await stakedLyxToken.deployed();
  console.log("StakedLyxToken implementation deployed to:", stakedLyxToken.address);

  console.log("deploying Pool...");
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(args);
  await pool.deployed();
  console.log("Pool implementation deployed to:", pool.address);

  console.log("deploying PoolValidators...");
  const PoolValidators = await ethers.getContractFactory("PoolValidators");
  const poolValidators = await PoolValidators.deploy(args);
  await poolValidators.deployed();
  console.log("PoolValidators implementation deployed to:", poolValidators.address);

  console.log("deploying MerkleDistributor...");
  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  const merkleDistributor = await MerkleDistributor.deploy(args);
  await merkleDistributor.deployed();
  console.log("MerkleDistributor implementation deployed to:", merkleDistributor.address);

  console.log("deploying Oracles...");
  const Oracles = await ethers.getContractFactory("Oracles");
  const oracles = await Oracles.deploy(args);
  await oracles.deployed();
  console.log("Oracles implementation deployed to:", oracles.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
