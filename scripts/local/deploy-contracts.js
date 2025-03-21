const { ethers } = require("hardhat");
const fs = require("fs");
const { getAccounts } = require("./utils/get-accounts");

async function deployLocalContracts(mute) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");

  const { admin, protocolFeeRecipient, operator, proxyOwner } = {
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
  const rewardsImplementation = await Rewards.deploy(args);
  let rewards = await AdminUpgradeabilityProxy.deploy(
    rewardsImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  rewards = Rewards.attach(rewards.address);

  await rewards.deployed();
  if (!mute) console.log("Rewards deployed to:", rewards.address);

  if (!mute) console.log("deploying StakedLyxToken...");
  const StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
  const stakedLyxTokenImplementation = await StakedLyxToken.deploy(args);
  let stakedLyxToken = await AdminUpgradeabilityProxy.deploy(
    stakedLyxTokenImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  stakedLyxToken = StakedLyxToken.attach(stakedLyxToken.address);

  await stakedLyxToken.deployed();
  if (!mute) console.log("StakedLyxToken deployed to:", stakedLyxToken.address);

  if (!mute) console.log("deploying Pool...");
  const Pool = await ethers.getContractFactory("Pool");
  const poolImplementation = await Pool.deploy(args);
  let pool = await AdminUpgradeabilityProxy.deploy(
    poolImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  pool = Pool.attach(pool.address);

  await pool.deployed();
  if (!mute) console.log("Pool deployed to:", pool.address);

  if (!mute) console.log("deploying PoolValidators...");
  const PoolValidators = await ethers.getContractFactory("PoolValidators");
  const poolValidatorsImplementation = await PoolValidators.deploy(args);
  let poolValidators = await AdminUpgradeabilityProxy.deploy(
    poolValidatorsImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  poolValidators = PoolValidators.attach(poolValidators.address);

  await poolValidators.deployed();
  if (!mute) console.log("PoolValidators deployed to:", poolValidators.address);

  if (!mute) console.log("deploying MerkleDistributor...");
  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  const merkleDistributorImplementation = await MerkleDistributor.deploy(args);
  let merkleDistributor = await AdminUpgradeabilityProxy.deploy(
    merkleDistributorImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  merkleDistributor = MerkleDistributor.attach(merkleDistributor.address);

  await merkleDistributor.deployed();
  if (!mute) console.log("MerkleDistributor deployed to:", merkleDistributor.address);

  if (!mute) console.log("deploying FeesEscrow...");
  const FeesEscrow = await ethers.getContractFactory("FeesEscrow");
  const feesEscrow = await FeesEscrow.deploy(rewards.address, args);
  await feesEscrow.deployed();
  if (!mute) console.log("FeesEscrow deployed to:", feesEscrow.address);

  if (!mute) console.log("deploying Oracles...");
  const Oracles = await ethers.getContractFactory("Oracles");
  const oraclesImplementation = await Oracles.deploy(args);
  let oracles = await AdminUpgradeabilityProxy.deploy(
    oraclesImplementation.address,
    proxyOwner.address,
    "0x",
    args
  );
  oracles = Oracles.attach(oracles.address);

  await oracles.deployed();
  if (!mute) console.log("Oracles deployed to:", oracles.address);

  if (!mute) console.log("deploying SwapV1Mock...");
  const SwapV1Mock = await ethers.getContractFactory("SwapV1Mock");
  const swapV1Mock = await SwapV1Mock.deploy(args);
  await swapV1Mock.deployed();
  if (!mute) console.log("SwapV1Mock deployed to:", swapV1Mock.address);

  if (!mute) console.log("Setup SwapV1Mock...");
  await swapV1Mock.setup(stakedLyxToken.address, args);
  if (!mute) console.log("SwapV1Mock setup");

  // Initialize the SwapV1Mock contract

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

  if (!mute) console.log("Operator address is ", operator.address);

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
      swapV1Mock: swapV1Mock.address,
      operator: operator.address,
    })
  );
}

if (require.main === module) {
  deployLocalContracts().catch(console.error);
}

module.exports = { deployLocalContracts };
