const { ethers } = require('hardhat');

async function main() {
  const args = {
    gasPrice: '0x59682F00', // 1.5 Gwei
  };

  const admin = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFeeRecipient = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFee = 0.1;

  const beaconDepositContract = '0x5Cc0ca9b4fe325Fa4c443475AE6C6d5f00d1631D'; // Lukso testnet

  console.log('deploying RewardLyxToken...');
  const RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
  const rewardLyxToken = await RewardLyxToken.deploy(args);
  await rewardLyxToken.deployed();
  console.log('RewardLyxToken deployed to:', rewardLyxToken.address);

  console.log('deploying StakedLyxToken...');
  const StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
  const stakedLyxToken = await StakedLyxToken.deploy(args);
  await rewardLyxToken.deployed();
  console.log('StakedLyxToken deployed to:', stakedLyxToken.address);

  console.log('deploying Pool...');
  const Pool = await ethers.getContractFactory('Pool');
  const pool = await Pool.deploy(args);
  await pool.deployed();
  console.log('Pool deployed to:', pool.address);

  console.log('deploying PoolValidators...');
  const PoolValidators = await ethers.getContractFactory('PoolValidators');
  const poolValidators = await PoolValidators.deploy(args);
  await poolValidators.deployed();
  console.log('PoolValidators deployed to:', poolValidators.address);

  console.log('deploying MerkleDistributor...');
  const MerkleDistributor = await ethers.getContractFactory(
    'MerkleDistributor'
  );
  const merkleDistributor = await MerkleDistributor.deploy(args);
  await merkleDistributor.deployed();
  console.log('MerkleDistributor deployed to:', merkleDistributor.address);

  console.log('deploying FeesEscrow...');
  const FeesEscrow = await ethers.getContractFactory('FeesEscrow');
  const feesEscrow = await FeesEscrow.deploy(
    pool.address,
    rewardLyxToken.address,
    args
  );
  await feesEscrow.deployed();
  console.log('FeesEscrow deployed to:', feesEscrow.address);

  console.log('deploying Oracles...');
  const Oracles = await ethers.getContractFactory('Oracles');
  const oracles = await Oracles.deploy(args);
  await oracles.deployed();
  console.log('Oracles deployed to:', oracles.address);

  // Initialize the Oracles contract
  console.log('Initializing Oracles...');
  await oracles.initialize(
    admin,
    rewardLyxToken.address,
    stakedLyxToken.address,
    pool.address,
    poolValidators.address,
    merkleDistributor.address,
    args
  );
  console.log('Oracles initialized');

  const withdrawalCredentials =
    '0x010000000000000000000000' + rewardLyxToken.address.slice(2);

  // Initialize RewardLyxToken

  console.log('Initializing RewardLyxToken...');
  await rewardLyxToken.initialize(
    admin,
    stakedLyxToken.address,
    oracles.address,
    protocolFeeRecipient,
    (protocolFee * 10000).toString(),
    merkleDistributor.address,
    feesEscrow.address,
    pool.address,
    args
  );
  console.log('RewardLyxToken initialized');

  // Initialize StakedLyxToken
  console.log('Initializing StakedLyxToken...');
  await stakedLyxToken.initialize(
    admin,
    pool.address,
    oracles.address,
    rewardLyxToken.address,
    args
  );
  console.log('StakedLyxToken initialized');

  // Initialize Pool
  console.log('Initializing Pool...');
  await pool.initialize(
    admin,
    stakedLyxToken.address,
    rewardLyxToken.address,
    poolValidators.address,
    oracles.address,
    withdrawalCredentials,
    beaconDepositContract,
    ethers.utils.parseEther('9999999999999999999999999999999'),
    '500',
    args
  );
  console.log('Pool initialized');

  // Initialize PoolValidators
  console.log('Initializing PoolValidators...');
  await poolValidators.initialize(admin, pool.address, oracles.address, args);
  console.log('PoolValidators initialized');

  console.log('Initializing MerkleDistributor...');
  await merkleDistributor.initialize(
    admin,
    rewardLyxToken.address,
    oracles.address
  );
  console.log('MerkleDistributor initialized');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
