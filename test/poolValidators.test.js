const { ethers } = require('hardhat');
const { expect } = require('chai');
const { getTestDepositData } = require('./utils');
const { generateDepositDataMerkle } = require('../utils/generate-merkle');

describe('PoolValidators contract', function () {
  const protocolFee = 0.1; // 10%
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  let Rewards, rewards;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin, operator, user1, oracles;

  before(async function () {
    Oracles = await ethers.getContractFactory('Oracles');
    Rewards = await ethers.getContractFactory('Rewards');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    Pool = await ethers.getContractFactory('Pool');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [admin, oracles, operator, user1] = await ethers.getSigners();
  });

  beforeEach(async function () {
    rewards = await Rewards.deploy();
    stakedLyxToken = await StakedLyxToken.deploy();
    pool = await Pool.deploy();
    poolValidators = await PoolValidators.deploy();
    merkleDistributor = await MerkleDistributor.deploy();
    beaconDepositMock = await DepositContract.deploy();
    feesEscrow = await FeesEscrow.deploy(rewards.address);
    await rewards.deployed();
    await stakedLyxToken.deployed();
    await pool.deployed();
    await poolValidators.deployed();
    await merkleDistributor.deployed();
    await feesEscrow.deployed();

    await rewards.initialize(
      admin.address,
      stakedLyxToken.address,
      oracles.address,
      admin.address,
      (protocolFee * 10000).toString(),
      merkleDistributor.address,
      feesEscrow.address,
      pool.address
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(
        admin.address,
        pool.address,
        oracles.address,
        rewards.address
      );

    await pool.connect(admin).initialize(
      admin.address,
      stakedLyxToken.address,
      rewards.address,
      poolValidators.address,
      oracles.address,
      getTestDepositData(operator.address)[0].withdrawalCredentials,
      beaconDepositMock.address,
      ethers.utils.parseEther('999999999'),
      '500' // Limit of pending validators: max 50% of pending validators
    );

    await poolValidators
      .connect(admin)
      .initialize(admin.address, pool.address, oracles.address);

    await merkleDistributor
      .connect(admin)
      .initialize(admin.address, rewards.address, oracles.address);
  });

  describe('addOperator', function () {
    it('should not be able to add operator address 0', async function () {
      await expect(
        poolValidators
          .connect(admin)
          .addOperator(
            ZERO_ADDRESS,
            '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
            '0x'
          )
      ).to.be.revertedWith('PoolValidators: invalid operator');
    });

    it('should not be able to add an operator without merkle root', async function () {
      await expect(
        poolValidators
          .connect(admin)
          .addOperator(
            operator.address,
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x'
          )
      ).to.be.revertedWith('PoolValidators: invalid merkle root');
    });

    it('should not be able to add an operator without merkle proofs', async function () {
      await expect(
        poolValidators
          .connect(admin)
          .addOperator(
            operator.address,
            '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
            ''
          )
      ).to.be.revertedWith('PoolValidators: invalid merkle proofs');
    });

    it('should not be able to add an operator with the same merkle root as previous', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await expect(
        poolValidators
          .connect(admin)
          .addOperator(
            operator.address,
            '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
            '0x'
          )
      ).to.be.revertedWith('PoolValidators: same merkle root');
    });

    it('should not be able to add an operator if sender not admin', async function () {
      await expect(
        poolValidators
          .connect(user1)
          .addOperator(
            operator.address,
            '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
            '0x'
          )
      ).to.be.revertedWith('OwnablePausable: access denied');
    });

    it('should emit OperatorAdded event when add an operator', async function () {
      await expect(
        poolValidators
          .connect(admin)
          .addOperator(
            operator.address,
            '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
            '0x'
          )
      )
        .to.emit(poolValidators, 'OperatorAdded')
        .withArgs(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );
    });

    it('should be able to add and get an operator', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      const response = await poolValidators.getOperator(operator.address);
      expect(response[0]).to.equal(
        '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588'
      );
      expect(response[1]).to.equal(false);
    });
  });

  describe('commitOperator', function () {
    it('should revert if operator not added', async function () {
      await expect(
        poolValidators.connect(operator).commitOperator()
      ).to.be.revertedWith('PoolValidators: invalid operator');
    });

    it('should revert if operator already committed', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await poolValidators.connect(operator).commitOperator();

      await expect(
        poolValidators.connect(operator).commitOperator()
      ).to.be.revertedWith('PoolValidators: invalid operator');
    });

    it('should be able to commit an operator', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await poolValidators.connect(operator).commitOperator();

      const response = await poolValidators.getOperator(operator.address);
      expect(response[0]).to.equal(
        '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588'
      );
      expect(response[1]).to.equal(true);
    });
  });

  describe('removeOperator', function () {
    it('should be able to remove an operator with admin', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await poolValidators.connect(admin).removeOperator(operator.address);

      const response = await poolValidators.getOperator(operator.address);
      expect(response[0]).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      );
      expect(response[1]).to.equal(false);
    });

    it('should be able to remove an operator with the concerned operator', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await poolValidators.connect(operator).removeOperator(operator.address);

      const response = await poolValidators.getOperator(operator.address);
      expect(response[0]).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      );
      expect(response[1]).to.equal(false);
    });

    it('should revert if sender not admin nor concerned operator', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await expect(
        poolValidators.connect(user1).removeOperator(operator.address)
      ).to.be.revertedWith('PoolValidators: access denied');
    });

    it('should revert if the operator do not exists', async function () {
      await expect(
        poolValidators.connect(admin).removeOperator(operator.address)
      ).to.be.revertedWith('PoolValidators: invalid operator');
    });

    it('should emit OperatorRemoved event when an operator is removed', async function () {
      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          '0xa3d6d8a69cbc6cb24fcddd9fb1ab79f0c26603542e07a3f41baee679f5113588',
          '0x'
        );

      await expect(
        poolValidators.connect(admin).removeOperator(operator.address)
      )
        .to.emit(poolValidators, 'OperatorRemoved')
        .withArgs(admin.address, operator.address);
    });
  });

  describe('registerValidator', function () {
    let depositData;
    let merkle;

    beforeEach(async function () {
      depositData = getTestDepositData(operator.address);
      merkle = generateDepositDataMerkle(depositData);
      await pool.connect(user1).stake({ value: ethers.utils.parseEther('32') });
      await poolValidators
        .connect(admin)
        .addOperator(operator.address, merkle.depositDataMerkleRoot, '0x');

      await poolValidators.connect(operator).commitOperator();
    });

    it('should be able to register a validator', async function () {
      await poolValidators
        .connect(oracles)
        .registerValidator(
          depositData[0],
          merkle.depositDataMerkleProofNodes[0]
        );
    });

    it('should not be able to register a validator if not enough funds', async function () {
      await poolValidators
        .connect(oracles)
        .registerValidator(
          depositData[0],
          merkle.depositDataMerkleProofNodes[0]
        );

      await expect(
        poolValidators
          .connect(oracles)
          .registerValidator(
            depositData[1],
            merkle.depositDataMerkleProofNodes[1]
          )
      ).to.be.revertedWithoutReason();
    });

    it('should not be able to register a validator if validator already registered', async function () {
      await poolValidators
        .connect(oracles)
        .registerValidator(
          depositData[0],
          merkle.depositDataMerkleProofNodes[0]
        );

      await expect(
        poolValidators
          .connect(oracles)
          .registerValidator(
            depositData[0],
            merkle.depositDataMerkleProofNodes[0]
          )
      ).to.be.revertedWith('PoolValidators: validator already registered');
    });

    it('should not be able to register a validator if sender not oracles contract', async function () {
      await expect(
        poolValidators
          .connect(admin)
          .registerValidator(
            depositData[0],
            merkle.depositDataMerkleProofNodes[0]
          )
      ).to.be.revertedWith('PoolValidators: access denied');
    });

    it('should not be able to register a validator if the merkle proofs are wrong', async function () {
      await expect(
        poolValidators
          .connect(oracles)
          .registerValidator(
            depositData[0],
            merkle.depositDataMerkleProofNodes[1]
          )
      ).to.be.revertedWith('PoolValidators: invalid merkle proof');
    });

    it('should not be able to register a validator if the operator do not exists', async function () {
      await expect(
        poolValidators
          .connect(oracles)
          .registerValidator(
            { ...depositData[0], operator: user1.address },
            merkle.depositDataMerkleProofNodes[0]
          )
      ).to.be.revertedWith('PoolValidators: invalid operator');
    });
  });
});
