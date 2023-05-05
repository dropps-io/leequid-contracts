const { ethers } = require('hardhat');
const { expect } = require('chai');
const { defaultAbiCoder, hexlify, keccak256 } = require('ethers/lib/utils');
const { generateDepositDataMerkle } = require('../utils/generate-merkle');

async function signMessage(signer, messageHash) {
  return await signer.signMessage(ethers.utils.arrayify(messageHash));
}

describe('Oracles contract', function () {
  const protocolFee = '1000';

  let Oracles, oracles;
  let RewardLyxToken, rewardLyxToken;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin, oracle, operator;
  let withdrawalCredentials =
    '0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab';

  before(async function () {
    Oracles = await ethers.getContractFactory('Oracles');
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    Pool = await ethers.getContractFactory('Pool');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [admin, oracle, operator] = await ethers.getSigners();
  });

  beforeEach(async function () {
    oracles = await Oracles.deploy();
    rewardLyxToken = await RewardLyxToken.deploy();
    stakedLyxToken = await StakedLyxToken.deploy();
    pool = await Pool.deploy();
    poolValidators = await PoolValidators.deploy();
    merkleDistributor = await MerkleDistributor.deploy();
    beaconDepositMock = await DepositContract.deploy();
    feesEscrow = await FeesEscrow.deploy(pool.address, rewardLyxToken.address);
    await oracles.deployed();
    await rewardLyxToken.deployed();
    await stakedLyxToken.deployed();
    await pool.deployed();
    await poolValidators.deployed();
    await merkleDistributor.deployed();
    await feesEscrow.deployed();

    await oracles.initialize(
      admin.address,
      rewardLyxToken.address,
      pool.address,
      poolValidators.address,
      merkleDistributor.address
    );

    await rewardLyxToken.initialize(
      admin.address,
      stakedLyxToken.address,
      oracles.address,
      admin.address,
      protocolFee,
      merkleDistributor.address,
      feesEscrow.address,
      false
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(admin.address, pool.address, rewardLyxToken.address, false);

    await pool
      .connect(admin)
      .initialize(
        admin.address,
        stakedLyxToken.address,
        poolValidators.address,
        oracles.address,
        withdrawalCredentials,
        beaconDepositMock.address
      );

    await poolValidators
      .connect(admin)
      .initialize(admin.address, pool.address, oracles.address);

    // Add oracle1, oracle2, oracle3 as oracles
    await oracles.connect(admin).addOracle(oracle.address);

    await admin.sendTransaction({
      to: pool.address,
      value: ethers.utils.parseEther('100'),
    });
  });

  it('Should register validators with enough signatures', async function () {
    // Prepare depositData, merkleProofs, and validatorsDepositRoot
    const depositData = [
      {
        operator: operator.address,
        publicKey:
          '0xb793d99ecfa2d9161ba94297085f09beb9f3bbebea65a7d02bc3cc9777a7c3822947369cb441c90181657c2e37d10568',
        withdrawalCredentials,
        signature:
          '0x9719cd1253fefa8665a8d5ce19d010991c0799536029f0b6e51fc4c9c73f9c12c9c0f354e30f19d5639af65db053e0c50eead303fcf63f985e7eaaa8aeb524638ebfe407de4b331793086c4efe9f108ce6b6a138dca87ae146d7acce3b561c21',
        depositDataRoot:
          '0xe852d0f1aaa289f8b9334e2c4a69c84bf0ede128b2a536611c12f72667e1194b',
      },
      {
        operator: operator.address,
        publicKey:
          '0x89c76fb58cf17cb012ec7ea3879707d5040e73fa9d16132ce075152f305406b9db80a833b742258c027816381d5b6f28',
        withdrawalCredentials,
        signature:
          '0xa8a6b651824d26a75aa0211bbf51a49d6d287e8b4a482726e9a7e28f7e746c457e336e743b469b70ecd8cfc7f48e7dfc0930d674205efb3bda1e08313c1e100f24cf00d6ec38e2666c8da2103aea815590dc2b8835dc5182e7ced2df9f73c72b',
        depositDataRoot:
          '0x99ae12c6380e6c65894b0e36cb42104bdf90c9fb7c307d47cb13a926e517247c',
      },
    ];

    const validatorsDepositRoot =
      '0xd70a234731285c6804c2a4f56711ddb8c82c99740f207854891028af34e27e5e'; // Replace with actual validators deposit root

    const merkle = generateDepositDataMerkle(depositData);

    await poolValidators
      .connect(admin)
      .addOperator(
        operator.address,
        merkle.depositDataMerkleRoot,
        merkle.depositDataMerkleProofsString
      );

    await poolValidators.connect(operator).commitOperator();

    // Calculate the nonce and the message to sign
    let nonce = await oracles.currentValidatorsNonce();
    let encoded = defaultAbiCoder.encode(
      [
        'uint256',
        'tuple(address operator,bytes32 withdrawalCredentials,bytes32 depositDataRoot,bytes publicKey,bytes signature)[]',
        'bytes32',
      ],
      [nonce.toString(), depositData, validatorsDepositRoot]
    );
    let candidateId = hexlify(keccak256(encoded));

    // Oracles sign the message
    const sig1 = await signMessage(oracle, candidateId);

    // Call registerValidators with the signatures
    await oracles
      .connect(oracle)
      .registerValidators(
        depositData,
        merkle.depositDataMerkleProofNodes,
        validatorsDepositRoot,
        [sig1]
      );

    // Check that the validatorsNonce has increased
    expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(
      nonce.add(1).toNumber()
    );
  });
});
