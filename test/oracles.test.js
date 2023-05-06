const { ethers } = require('hardhat');
const { expect } = require('chai');
const { generateDepositDataMerkle } = require('../utils/generate-merkle');
const {
  getTestDepositData,
  generateSignaturesForRegisterValidators,
  generateSignaturesForSubmitRewards,
  registerValidators,
} = require('./utils');

describe('Oracles contract', function () {
  const protocolFee = 0.1; // 10%

  let Oracles, oracles;
  let RewardLyxToken, rewardLyxToken;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin,
    oracle1,
    oracle2,
    oracle3,
    oracle4,
    operator,
    user1,
    user2,
    user3,
    user4;

  before(async function () {
    Oracles = await ethers.getContractFactory('Oracles');
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    Pool = await ethers.getContractFactory('Pool');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [
      admin,
      oracle1,
      oracle2,
      oracle3,
      oracle4,
      operator,
      user1,
      user2,
      user3,
      user4,
    ] = await ethers.getSigners();
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
      (protocolFee * 10000).toString(),
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
        getTestDepositData(operator.address)[0].withdrawalCredentials,
        beaconDepositMock.address,
        ethers.utils.parseEther('9999999999999999999999999999999'),
        '500'
      );

    await poolValidators
      .connect(admin)
      .initialize(admin.address, pool.address, oracles.address);

    // Add oracle1, oracle2, oracle3 as oracles
    await oracles.connect(admin).addOracle(oracle1.address);
    await oracles.connect(admin).addOracle(oracle2.address);
    await oracles.connect(admin).addOracle(oracle3.address);
    await oracles.connect(admin).addOracle(oracle4.address);
  });

  describe('registerValidators', function () {
    beforeEach(async function () {
      await admin.sendTransaction({
        to: pool.address,
        value: ethers.utils.parseEther('100'),
      });
    });

    it('Should register validators with enough signatures', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = getTestDepositData(operator.address);
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
      const nonce = await oracles.currentValidatorsNonce();
      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await oracles
        .connect(oracle1)
        .registerValidators(
          depositData,
          merkle.depositDataMerkleProofNodes,
          validatorsDepositRoot,
          signatures
        );

      const depositCount = await beaconDepositMock.get_deposit_count();

      expect(depositCount).to.equal('0x0200000000000000');
      // Check that the validatorsNonce has increased
      expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(
        nonce.add(1).toNumber()
      );
    });

    it('Should emit an log RegisterValidatorsVoteSubmitted', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = getTestDepositData(operator.address);
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
      const nonce = await oracles.currentValidatorsNonce();
      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      await expect(
        oracles
          .connect(oracle1)
          .registerValidators(
            depositData,
            merkle.depositDataMerkleProofNodes,
            validatorsDepositRoot,
            signatures
          )
      )
        .to.emit(oracles, 'RegisterValidatorsVoteSubmitted')
        .withArgs(
          oracle1.address,
          [oracle1.address, oracle2.address, oracle3.address, oracle4.address],
          0
        );
    });

    it('Should revert when not enough signatures', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = getTestDepositData(operator.address);
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
      const nonce = await oracles.currentValidatorsNonce();
      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .registerValidators(
            depositData,
            merkle.depositDataMerkleProofNodes,
            validatorsDepositRoot,
            signatures
          )
      ).to.be.revertedWith('Oracles: invalid number of signatures');

      const depositCount = await beaconDepositMock.get_deposit_count();

      expect(depositCount).to.equal('0x0000000000000000');
      // Check that the validatorsNonce has increased
      expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(0);
    });

    it('Should revert if wrong signature', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = getTestDepositData(operator.address);
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
      const nonce = await oracles.currentValidatorsNonce();
      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, admin],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .registerValidators(
            depositData,
            merkle.depositDataMerkleProofNodes,
            validatorsDepositRoot,
            signatures
          )
      ).to.be.revertedWith('Oracles: invalid signer');

      const depositCount = await beaconDepositMock.get_deposit_count();

      expect(depositCount).to.equal('0x0000000000000000');
      // Check that the validatorsNonce has increased
      expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(0);
    });

    it('Should revert if repeated signature', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = getTestDepositData(operator.address);
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
      const nonce = await oracles.currentValidatorsNonce();
      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, oracle3],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .registerValidators(
            depositData,
            merkle.depositDataMerkleProofNodes,
            validatorsDepositRoot,
            signatures
          )
      ).to.be.revertedWith('Oracles: repeated signature');

      const depositCount = await beaconDepositMock.get_deposit_count();

      expect(depositCount).to.equal('0x0000000000000000');
      // Check that the validatorsNonce has increased
      expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(0);
    });

    it('Should register validators multiple times', async function () {
      const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
      const depositData = [getTestDepositData(operator.address)[0]];
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

      const signatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        depositData,
        validatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await oracles
        .connect(oracle1)
        .registerValidators(
          depositData,
          merkle.depositDataMerkleProofNodes,
          validatorsDepositRoot,
          signatures
        );

      const newValidatorsDepositRoot =
        await beaconDepositMock.get_deposit_root();
      const newDepositData = [getTestDepositData(operator.address)[1]];
      const newMerkle = generateDepositDataMerkle(newDepositData);

      await poolValidators
        .connect(admin)
        .addOperator(
          operator.address,
          newMerkle.depositDataMerkleRoot,
          newMerkle.depositDataMerkleProofsString
        );

      await poolValidators.connect(operator).commitOperator();

      // Calculate the nonce and the message to sign
      nonce = await oracles.currentValidatorsNonce();

      const newSignatures = await generateSignaturesForRegisterValidators(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        newDepositData,
        newValidatorsDepositRoot
      );

      // Call registerValidators with the signatures
      await oracles
        .connect(oracle1)
        .registerValidators(
          newDepositData,
          newMerkle.depositDataMerkleProofNodes,
          newValidatorsDepositRoot,
          newSignatures
        );

      const depositCount = await beaconDepositMock.get_deposit_count();

      expect(depositCount).to.equal('0x0200000000000000');
      // Check that the validatorsNonce has increased
      expect((await oracles.currentValidatorsNonce()).toNumber()).to.equal(
        nonce.add(1).toNumber()
      );
    });
  });

  describe('submitRewards', function () {
    const stakedAmount = 100000; // eth
    const totalRewards = 100; // eth
    const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 4).toString());
    const activatedValidators = 2;

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });

      await registerValidators(
        getTestDepositData(operator.address),
        oracles,
        poolValidators,
        beaconDepositMock,
        [oracle1, oracle2, oracle3, oracle4],
        admin,
        operator
      );
    });

    it('Should submit rewards with enough signatures', async function () {
      // Calculate the nonce and the message to sign
      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      // Call submitRewards with the signatures
      await oracles
        .connect(oracle1)
        .submitRewards(totalRewardsWei, activatedValidators, signatures);

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      // Check that the rewardsNonce has increased
      expect((await oracles.currentRewardsNonce()).toNumber()).to.equal(
        nonce.add(1).toNumber()
      );
    });

    it('Should emit a RewardsVoteSubmitted event', async function () {
      // Calculate the nonce and the message to sign
      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      await expect(
        oracles
          .connect(oracle1)
          .submitRewards(totalRewardsWei, activatedValidators, signatures)
      )
        .to.emit(oracles, 'RewardsVoteSubmitted')
        .withArgs(
          oracle1.address,
          [oracle1.address, oracle2.address, oracle3.address, oracle4.address],
          nonce,
          totalRewardsWei,
          activatedValidators
        );
    });

    it('Should revert when not enough signatures', async function () {
      // Calculate the nonce and the message to sign
      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      // Call submitRewards with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .submitRewards(totalRewardsWei, activatedValidators, signatures)
      ).to.be.revertedWith('Oracles: invalid number of signatures');
    });

    it('Should revert if wrong signature', async function () {
      // Calculate the nonce and the message to sign
      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, admin],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      // Call submitRewards with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .submitRewards(totalRewardsWei, activatedValidators, signatures)
      ).to.be.revertedWith('Oracles: invalid signer');
    });

    it('Should revert if repeated signature', async function () {
      // Calculate the nonce and the message to sign
      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, oracle3],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      // Call submitRewards with the signatures
      await expect(
        oracles
          .connect(oracle1)
          .submitRewards(totalRewardsWei, activatedValidators, signatures)
      ).to.be.revertedWith('Oracles: repeated signature');
    });

    it('Should be able to register rewards multiple times', async function () {
      // Calculate the nonce and the message to sign
      let nonce = await oracles.currentRewardsNonce();
      let signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        totalRewardsWei,
        activatedValidators
      );

      // Call submitRewards with the signatures
      await oracles
        .connect(oracle1)
        .submitRewards(totalRewardsWei, activatedValidators, signatures);

      nonce = await oracles.currentRewardsNonce();
      signatures = await generateSignaturesForSubmitRewards(
        [oracle1, oracle2, oracle3, oracle4],
        nonce.toString(),
        ethers.utils.parseEther('200'),
        activatedValidators
      );

      await oracles
        .connect(oracle1)
        .submitRewards(
          ethers.utils.parseEther('200'),
          activatedValidators,
          signatures
        );

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * 2 * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards * 2 - totalRewards * 2 * protocolFee) / 4).toString()
        )
      );
      // Check that the rewardsNonce has increased
      expect((await oracles.currentRewardsNonce()).toNumber()).to.equal(
        nonce.add(1).toNumber()
      );
    });
  });
});
