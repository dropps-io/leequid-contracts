const { ethers } = require('hardhat');
const fs = require('fs');
const { getAccounts } = require('./utils/get-accounts');
const { generateDepositDataMerkle } = require('../../utils/generate-merkle');
const {
  formatGeneratedDepositData,
} = require('../../utils/format-deposit-data');
const deposit_data = require('./test-deposit-data.json');

async function main() {
  const { admin, operator, protocolFeeRecipient } = {
    ...(await getAccounts()),
  };
  const args = {
    gasPrice: '0xB2D05E00', // 3 Gwei
  };

  const protocolFee = 0.1;

  console.log('deploying MockBeacon...');
  const MockBeacon = await ethers.getContractFactory('DepositContract');
  const mockBeacon = await MockBeacon.deploy(args);
  await mockBeacon.deployed();
  console.log('MockBeacon deployed to:', mockBeacon.address);

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
  const feesEscrow = await FeesEscrow.deploy(rewardLyxToken.address, args);
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
    admin.address,
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
  console.log('RewardLyxToken initialized');

  // Initialize StakedLyxToken
  console.log('Initializing StakedLyxToken...');
  await stakedLyxToken.initialize(
    admin.address,
    pool.address,
    oracles.address,
    rewardLyxToken.address,
    args
  );
  console.log('StakedLyxToken initialized');

  // Initialize Pool
  console.log('Initializing Pool...');
  await pool.initialize(
    admin.address,
    stakedLyxToken.address,
    rewardLyxToken.address,
    poolValidators.address,
    oracles.address,
    withdrawalCredentials,
    mockBeacon.address,
    ethers.utils.parseEther('9999999999999999999999999999999'),
    '500',
    args
  );
  console.log('Pool initialized');

  // Initialize PoolValidators
  console.log('Initializing PoolValidators...');
  await poolValidators.initialize(
    admin.address,
    pool.address,
    oracles.address,
    args
  );
  console.log('PoolValidators initialized');

  console.log('Initializing MerkleDistributor...');
  await merkleDistributor.initialize(
    admin.address,
    rewardLyxToken.address,
    oracles.address
  );
  console.log('MerkleDistributor initialized');

  const merkleTree = generateDepositDataMerkle(
    formatGeneratedDepositData(deposit_data)
  );

  await poolValidators
    .connect(admin)
    .addOperator(
      operator.address,
      merkleTree.depositDataMerkleRoot,
      '0x0000000'
    );

  await poolValidators.connect(operator).commitOperator();

  console.log('Operator added and committed');

  fs.writeFileSync(
    'local_addresses.json',
    JSON.stringify({
      MockBeacon: mockBeacon.address,
      RewardLyxToken: rewardLyxToken.address,
      StakedLyxToken: stakedLyxToken.address,
      MerkleDistributor: merkleDistributor.address,
      Oracles: oracles.address,
      Pool: pool.address,
      PoolValidators: poolValidators.address,
      FeesEscrow: feesEscrow.address,
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
