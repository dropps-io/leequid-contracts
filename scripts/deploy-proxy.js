const { ethers } = require("hardhat");

async function main() {
  const args = {
    gasPrice: "0x1DCD65000", // 8 Gwei
  };

  const admin = "0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab";
  const proxyAdmin = "0x0C92EC41A0Aba4F33B69dA6a931A7F74C309d143";
  const protocolFeeRecipient = "0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab";
  const protocolFee = 0.1;

  const beaconDepositContract = "0xCAfe00000000000000000000000000000000CAfe"; // Lukso testnet

  const AdminUpgradeabilityProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");

  console.log("deploying Rewards...");
  const Rewards = await ethers.getContractFactory("Rewards");
  const rewards = await Rewards.deploy(args);
  await rewards.deployed();
  const rewardsProxy = await AdminUpgradeabilityProxy.deploy(
    rewards.address,
    proxyAdmin,
    "0x",
    args
  );
  console.log("Rewards deployed to:", rewardsProxy.address);
  console.log("Rewards implementation deployed to:", rewards.address);

  // Create an interface of your contract
  const rewardsProxyContract = Rewards.attach(rewardsProxy.address);

  console.log("deploying StakedLyxToken...");
  const StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
  const stakedLyxToken = await StakedLyxToken.deploy(args);
  await stakedLyxToken.deployed();
  const stakedLyxTokenProxy = await AdminUpgradeabilityProxy.deploy(
    stakedLyxToken.address,
    proxyAdmin,
    "0x",
    args
  );
  console.log("StakedLyxToken deployed to:", stakedLyxTokenProxy.address);
  console.log("StakedLyxToken implementation deployed to:", stakedLyxToken.address);

  // Create an interface of your contract
  const stakedLyxTokenProxyContract = StakedLyxToken.attach(stakedLyxTokenProxy.address);

  console.log("deploying Pool...");
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(args);
  await pool.deployed();
  const poolProxy = await AdminUpgradeabilityProxy.deploy(pool.address, proxyAdmin, "0x", args);
  console.log("Pool deployed to:", poolProxy.address);
  console.log("Pool implementation deployed to:", pool.address);

  // Create an interface of your contract
  const poolProxyContract = Pool.attach(poolProxy.address);

  console.log("deploying PoolValidators...");
  const PoolValidators = await ethers.getContractFactory("PoolValidators");
  const poolValidators = await PoolValidators.deploy(args);
  await poolValidators.deployed();
  const poolValidatorsProxy = await AdminUpgradeabilityProxy.deploy(
    poolValidators.address,
    proxyAdmin,
    "0x",
    args
  );
  console.log("PoolValidators deployed to:", poolValidatorsProxy.address);
  console.log("PoolValidators implementation deployed to:", poolValidators.address);

  // Create an interface of your contract
  const poolValidatorsProxyContract = PoolValidators.attach(poolValidatorsProxy.address);

  console.log("deploying MerkleDistributor...");
  const MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
  const merkleDistributor = await MerkleDistributor.deploy(args);
  await merkleDistributor.deployed();
  const merkleDistributorProxy = await AdminUpgradeabilityProxy.deploy(
    merkleDistributor.address,
    proxyAdmin,
    "0x",
    args
  );
  console.log("MerkleDistributor deployed to:", merkleDistributorProxy.address);
  console.log("MerkleDistributor implementation deployed to:", merkleDistributor.address);

  // Create an interface of your contract
  const merkleDistributorProxyContract = MerkleDistributor.attach(merkleDistributorProxy.address);

  console.log("deploying FeesEscrow...");
  const FeesEscrow = await ethers.getContractFactory("FeesEscrow");
  const feesEscrow = await FeesEscrow.deploy(rewardsProxy.address, args);
  await feesEscrow.deployed();
  console.log("FeesEscrow deployed to:", feesEscrow.address);

  console.log("deploying Oracles...");
  const Oracles = await ethers.getContractFactory("Oracles");
  const oracles = await Oracles.deploy(args);
  await oracles.deployed();
  const oraclesProxy = await AdminUpgradeabilityProxy.deploy(
    oracles.address,
    proxyAdmin,
    "0x",
    args
  );
  console.log("Oracles deployed to:", oraclesProxy.address);
  console.log("Oracles implementation deployed to:", oracles.address);

  // Create an interface of your contract
  const oraclesProxyContract = Oracles.attach(oraclesProxy.address);

  // Initialize the Oracles contract
  console.log("Initializing Oracles...");
  await oraclesProxyContract.initialize(
    admin,
    rewardsProxy.address,
    stakedLyxTokenProxy.address,
    poolProxy.address,
    poolValidatorsProxy.address,
    merkleDistributorProxy.address,
    args
  );
  console.log("Oracles initialized");

  const withdrawalCredentials = "0x010000000000000000000000" + rewardsProxy.address.slice(2);

  // Initialize Rewards
  console.log("Initializing Rewards...");
  await rewardsProxyContract.initialize(
    admin,
    stakedLyxTokenProxy.address,
    oraclesProxy.address,
    protocolFeeRecipient,
    (protocolFee * 10000).toString(),
    merkleDistributorProxy.address,
    feesEscrow.address,
    poolProxy.address,
    args
  );
  console.log("Rewards initialized");

  // Initialize StakedLyxToken
  console.log("Initializing StakedLyxToken...");
  await stakedLyxTokenProxyContract.initialize(
    admin,
    poolProxy.address,
    oraclesProxy.address,
    rewardsProxy.address,
    args
  );
  console.log("StakedLyxToken initialized");

  // Initialize Pool
  console.log("Initializing Pool...");
  await poolProxyContract.initialize(
    admin,
    stakedLyxTokenProxy.address,
    rewardsProxy.address,
    poolValidatorsProxy.address,
    oraclesProxy.address,
    withdrawalCredentials,
    beaconDepositContract,
    ethers.utils.parseEther("9999999999999999999999999999999"),
    "500",
    args
  );
  console.log("Pool initialized");

  // Initialize PoolValidators
  console.log("Initializing PoolValidators...");
  await poolValidatorsProxyContract.initialize(
    admin,
    poolProxy.address,
    oraclesProxy.address,
    args
  );
  console.log("PoolValidators initialized");

  console.log("Initializing MerkleDistributor...");
  await merkleDistributorProxyContract.initialize(
    admin,
    rewardsProxy.address,
    oraclesProxy.address,
    args
  );
  console.log("MerkleDistributor initialized");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
