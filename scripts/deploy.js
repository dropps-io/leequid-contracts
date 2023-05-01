const ethers = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  const isNonDivisible = false;
  const admin = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFeeRecipient = '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab';
  const protocolFee = '1000';

  const withdrawalCredentials = '0x0000';

  const validatorRegistrationContract = '0x0000';

  const RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
  const rewardLyxToken = await RewardLyxToken.deploy();
  await rewardLyxToken.deployed();

  const StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
  const stakedLyxToken = await StakedLyxToken.deploy();
  await rewardLyxToken.deployed();

  const Pool = await ethers.getContractFactory('Pool');
  const pool = await Pool.deploy();
  await pool.deployed();

  const PoolValidators = await ethers.getContractFactory('PoolValidators');
  const poolValidators = await PoolValidators.deploy();
  await poolValidators.deployed();

  const MerkleDistributor = await ethers.getContractFactory(
    'MerkleDistributor'
  );
  const merkleDistributor = await MerkleDistributor.deploy();
  await merkleDistributor.deployed();

  const FeesEscrow = await ethers.getContractFactory('FeesEscrow');
  const feesEscrow = await FeesEscrow.deploy();
  await feesEscrow.deployed();

  const Oracles = await ethers.getContractFactory('Oracles');
  const oracles = await Oracles.deploy();
  await oracles.deployed();

  // Initialize the Oracles contract
  await oracles.initialize(deployer);

  // Initialize RewardLyxToken
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

  await stakedLyxToken.initialize(admin, pool.address, rewardLyxToken.address, isNonDivisible);

  await pool.initialize(
    admin,
    stakedLyxToken,
    poolValidators.address,
    oracles.address,
    withdrawalCredentials,
    validatorRegistrationContract
  );

  await poolValidators.initialize(
    admin,
    pool.address,
    oracles.address,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
