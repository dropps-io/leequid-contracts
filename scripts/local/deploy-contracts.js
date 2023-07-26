const { ethers } = require("hardhat");
const fs = require("fs");
const { getAccounts } = require("./utils/get-accounts");

async function deployLocalContracts(mute) {
  const { admin, protocolFeeRecipient } = {
    ...(await getAccounts()),
  };

  const args = {
    gasPrice: "0xB2D05E00", // 3 Gwei
  };

  const protocolFee = 0.1;

  if (!mute) console.log("deploying MockBeacon...");
  const MockBeacon = await ethers.getContractFactory("DepositContract");
  const mockBeacon = await MockBeacon.deploy(args);
  await mockBeacon.deployed();
  if (!mute) console.log("MockBeacon deployed to:", mockBeacon.address);

  if (!mute) console.log("deploying Rewards...");
  const Rewards = await ethers.getContractFactory("Rewards");
  const rewards = await Rewards.deploy(args);
  await rewards.deployed();
  if (!mute) console.log("Rewards deployed to:", rewards.address);

  if (!mute) console.log("deploying StakedLyxToken...");
  const StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
  const stakedLyxToken = await StakedLyxToken.deploy(args);
  await rewards.deployed();
  if (!mute) console.log("StakedLyxToken deployed to:", stakedLyxToken.address);

  if (!mute) console.log("deploying Pool...");
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(args);
  await pool.deployed();
  if (!mute) console.log("Pool deployed to:", pool.address);

  if (!mute) console.log("deploying PoolValidators...");
  const PoolValidators = await ethers.getContractFactory("PoolValidators");
  const poolValidators = await PoolValidators.deploy(args);
  await poolValidators.deployed();
  if (!mute) console.log("PoolValidators deployed to:", poolValidators.address);

  if (!mute) console.log("deploying MerkleDistributor...");
  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  const merkleDistributor = await MerkleDistributor.deploy(args);
  await merkleDistributor.deployed();
  if (!mute) console.log("MerkleDistributor deployed to:", merkleDistributor.address);

  if (!mute) console.log("deploying FeesEscrow...");
  const FeesEscrow = await ethers.getContractFactory("FeesEscrow");
  const feesEscrow = await FeesEscrow.deploy(rewards.address, args);
  await feesEscrow.deployed();
  if (!mute) console.log("FeesEscrow deployed to:", feesEscrow.address);

  if (!mute) console.log("deploying Oracles...");
  const Oracles = await ethers.getContractFactory("Oracles");
  const oracles = await Oracles.deploy(args);
  await oracles.deployed();
  if (!mute) console.log("Oracles deployed to:", oracles.address);

  // Initialize the Oracles contract
  if (!mute) console.log("Initializing Oracles...");
  await oracles.initialize(
    admin.address,
    rewards.address,
    stakedLyxToken.address,
    pool.address,
    poolValidators.address,
    merkleDistributor.address,
    args
  );
  if (!mute) console.log("Oracles initialized");

  const withdrawalCredentials = "0x010000000000000000000000" + rewards.address.slice(2);

  // Initialize Rewards

  if (!mute) console.log("Initializing Rewards...");
  await rewards.initialize(
    admin.address,
    stakedLyxToken.address,
    oracles.address,
    protocolFeeRecipient.address,
    (protocolFee * 10000).toString(),
    merkleDistributor.address,
    feesEscrow.address,
    pool.address,
    args
  );
  if (!mute) console.log("Rewards initialized");

  // Initialize StakedLyxToken
  if (!mute) console.log("Initializing StakedLyxToken...");
  await stakedLyxToken.initialize(
    admin.address,
    pool.address,
    oracles.address,
    rewards.address,
    args
  );
  if (!mute) console.log("StakedLyxToken initialized");

  // Initialize Pool
  if (!mute) console.log("Initializing Pool...");
  await pool.initialize(
    admin.address,
    stakedLyxToken.address,
    rewards.address,
    poolValidators.address,
    oracles.address,
    withdrawalCredentials,
    mockBeacon.address,
    ethers.utils.parseEther("9999999999999999999999999999999"),
    "500",
    args
  );
  if (!mute) console.log("Pool initialized");

  // Initialize PoolValidators
  if (!mute) console.log("Initializing PoolValidators...");
  await poolValidators.initialize(admin.address, pool.address, oracles.address, args);
  if (!mute) console.log("PoolValidators initialized");

  if (!mute) console.log("Initializing MerkleDistributor...");
  await merkleDistributor.initialize(admin.address, rewards.address, oracles.address);
  if (!mute) console.log("MerkleDistributor initialized");

  fs.writeFileSync(
    "local_addresses.json",
    JSON.stringify({
      deposit: mockBeacon.address,
      rewards: rewards.address,
      stakedLyxToken: stakedLyxToken.address,
      merkleDistributor: merkleDistributor.address,
      oracles: oracles.address,
      pool: pool.address,
      poolValidators: poolValidators.address,
      peesEscrow: feesEscrow.address,
    })
  );
}

if (require.main === module) {
  deployLocalContracts().catch(console.error);
}

module.exports = { deployLocalContracts };
