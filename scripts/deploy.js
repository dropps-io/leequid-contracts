const { ethers } = require('hardhat');

async function main() {
  const isNonDivisible = false;
  const admin = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFeeRecipient = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFee = '1000';

  const withdrawalCredentials =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const beaconDepositContract = '0x96Be67ddB9E815e4Ccd833A564131579a8698f09'; // Sepolia testnet

  console.log('deploying RewardLyxToken...');
  const RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
  const rewardLyxToken = await RewardLyxToken.deploy();
  await rewardLyxToken.deployed();
  console.log('RewardLyxToken deployed to:', rewardLyxToken.address);

  console.log('deploying StakedLyxToken...');
  const StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
  const stakedLyxToken = await StakedLyxToken.deploy();
  await rewardLyxToken.deployed();
  console.log('StakedLyxToken deployed to:', stakedLyxToken.address);

  console.log('deploying Pool...');
  const Pool = await ethers.getContractFactory('Pool');
  const pool = await Pool.deploy();
  await pool.deployed();
  console.log('Pool deployed to:', pool.address);

  console.log('deploying PoolValidators...');
  const PoolValidators = await ethers.getContractFactory('PoolValidators');
  const poolValidators = await PoolValidators.deploy();
  await poolValidators.deployed();
  console.log('PoolValidators deployed to:', poolValidators.address);

  console.log('deploying MerkleDistributor...');
  const MerkleDistributor = await ethers.getContractFactory(
    'MerkleDistributor'
  );
  const merkleDistributor = await MerkleDistributor.deploy();
  await merkleDistributor.deployed();
  console.log('MerkleDistributor deployed to:', merkleDistributor.address);

  console.log('deploying FeesEscrow...');
  const FeesEscrow = await ethers.getContractFactory('FeesEscrow');
  const feesEscrow = await FeesEscrow.deploy(
    pool.address,
    rewardLyxToken.address
  );
  await feesEscrow.deployed();
  console.log('FeesEscrow deployed to:', feesEscrow.address);

  console.log('deploying Oracles...');
  const Oracles = await ethers.getContractFactory('Oracles');
  const oracles = await Oracles.deploy();
  await oracles.deployed();
  console.log('Oracles deployed to:', oracles.address);

  // Initialize the Oracles contract
  console.log('Initializing Oracles...');
  await oracles.initialize(admin);
  console.log('Oracles initialized');

  // Initialize RewardLyxToken

  console.log('Initializing RewardLyxToken...');
  await rewardLyxToken.initialize(
    admin,
    stakedLyxToken.address,
    oracles.address,
    protocolFeeRecipient,
    protocolFee,
    merkleDistributor.address,
    feesEscrow.address,
    isNonDivisible
  );
  console.log('RewardLyxToken initialized');

  // Initialize StakedLyxToken
  console.log('Initializing StakedLyxToken...');
  await stakedLyxToken.initialize(
    admin,
    pool.address,
    rewardLyxToken.address,
    isNonDivisible
  );
  console.log('StakedLyxToken initialized');

  // Initialize Pool
  console.log('Initializing Pool...');
  await pool.initialize(
    admin,
    stakedLyxToken.address,
    poolValidators.address,
    oracles.address,
    withdrawalCredentials,
    beaconDepositContract
  );
  console.log('Pool initialized');

  // Initialize PoolValidators
  console.log('Initializing PoolValidators...');
  await poolValidators.initialize(admin, pool.address, oracles.address);
  console.log('PoolValidators initialized');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
