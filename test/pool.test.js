const { ethers } = require('hardhat');
const { expect } = require('chai');
const {
  getTestDepositData,
  registerValidators,
  generateSignaturesForSubmitRewards,
} = require('./utils');

describe('Pool contract', function () {
  const protocolFee = 0.1; // 10%
  const minDepositForActivation = 5; // 5 LYX
  const ZERRO_ADDRESS = '0x0000000000000000000000000000000000000000';

  let Oracles, oracles;
  let RewardLyxToken, rewardLyxToken;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin, oracle, operator, user1, user2;

  before(async function () {
    Oracles = await ethers.getContractFactory('Oracles');
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    Pool = await ethers.getContractFactory('Pool');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [admin, oracle, operator, user1, user2] = await ethers.getSigners();
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
      stakedLyxToken.address,
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
      pool.address
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(
        admin.address,
        pool.address,
        oracles.address,
        rewardLyxToken.address
      );

    await pool.connect(admin).initialize(
      admin.address,
      stakedLyxToken.address,
      rewardLyxToken.address,
      poolValidators.address,
      oracles.address,
      getTestDepositData(operator.address)[0].withdrawalCredentials,
      beaconDepositMock.address,
      ethers.utils.parseEther(minDepositForActivation.toString()),
      '500' // Limit of pending validators: max 50% of pending validators
    );

    await poolValidators
      .connect(admin)
      .initialize(admin.address, pool.address, oracles.address);

    await merkleDistributor
      .connect(admin)
      .initialize(admin.address, rewardLyxToken.address, oracles.address);

    await oracles.connect(admin).addOracle(oracle.address);

    const depositData = [
      getTestDepositData(operator.address)[0],
      getTestDepositData(operator.address)[1],
    ];
    // So it mints directly when stake more than minActivatingDeposit
    await pool
      .connect(admin)
      .setMinActivatingDeposit(ethers.utils.parseEther('999999999'));
    await pool.connect(user2).stake({ value: ethers.utils.parseEther('64') });

    await registerValidators(
      depositData,
      oracles,
      poolValidators,
      beaconDepositMock,
      [oracle],
      admin,
      operator
    );

    const nonce = await oracles.currentRewardsNonce();
    const signatures = await generateSignaturesForSubmitRewards(
      [oracle],
      nonce.toString(),
      ethers.utils.parseEther('100'),
      depositData.length
    );

    // Call submitRewards with the signatures
    await oracles
      .connect(oracle)
      .submitRewards(
        ethers.utils.parseEther('100'),
        depositData.length,
        signatures
      );

    await pool
      .connect(admin)
      .setMinActivatingDeposit(
        ethers.utils.parseEther(minDepositForActivation.toString())
      );
  });

  describe('stake', function () {
    it('should be able to stake by calling the stake method', async function () {
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await pool.connect(user1).stake({ value: ethers.utils.parseEther('1') });
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const poolBalance = await ethers.provider.getBalance(pool.address);

      expect(balanceAfter).to.below(
        balanceBefore.sub(ethers.utils.parseEther('1'))
      );
      expect(poolBalance).to.be.equal(ethers.utils.parseEther('1'));
    });

    it('should mint sLYX directly when stake less than minActivatingDeposit', async function () {
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('31'),
      });
      const sLYXBalance = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalance).to.be.equal(ethers.utils.parseEther('31'));
    });

    it('should mint sLYX directly when stake more than minActivatingDeposit, but under pendingValidatorsMax', async function () {
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('31'),
      });
      const sLYXBalance = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalance).to.be.equal(ethers.utils.parseEther('31'));
    });

    it('should not mint sLYX directly when stake more than minActivatingDeposit, but above pendingValidatorsMax', async function () {
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });
      const sLYXBalance = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalance).to.be.equal(ethers.utils.parseEther('0'));
    });

    it('should emit ActivationScheduled when stake more than minActivatingDeposit, but above pendingValidatorsMax', async function () {
      await expect(
        pool.connect(user1).stake({
          value: ethers.utils.parseEther('32'),
        })
      )
        .to.emit(pool, 'ActivationScheduled')
        .withArgs(user1.address, 3, ethers.utils.parseEther('32'));
    });

    it('should not be able to stake on with value 0', async function () {
      await expect(pool.connect(user1).stake()).to.be.revertedWith(
        'Pool: invalid deposit amount'
      );
    });

    it('should not be able to stake on behalf of address 0', async function () {
      await expect(
        pool
          .connect(user1)
          .stakeOnBehalf(ZERRO_ADDRESS, { value: ethers.utils.parseEther('1') })
      ).to.be.revertedWith('Pool: invalid recipient');
    });
  });

  describe('activate', function () {
    it('should revert when activating pending deposits not active', async function () {
      // pending activation as 32LYX is 50% of 64LYX (current amount staked)
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });

      await expect(
        pool.connect(user1).activate(user1.address, 3)
      ).to.revertedWith('Pool: validator is not active yet');
    });

    it('should revert when activating invalid validator index', async function () {
      await expect(
        pool.connect(user2).activate(user2.address, 1)
      ).to.revertedWith('Pool: invalid validator index');
    });

    it('should be able to activate pending deposits', async function () {
      // pending activation as 32LYX is 50% of 64LYX (current amount staked)
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });

      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await registerValidators(
        depositData,
        oracles,
        poolValidators,
        beaconDepositMock,
        [oracle],
        admin,
        operator
      );

      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle],
        nonce.toString(),
        ethers.utils.parseEther('100'),
        3
      );

      // Once the rewards are submitted with the new number of validators, the activatedValidators value is updated
      // Meaning the new maxIndex increased so we can activate our deposit
      await oracles
        .connect(oracle)
        .submitRewards(ethers.utils.parseEther('100'), 3, signatures);

      const sLYXBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
      await pool.connect(user1).activate(user1.address, 3);
      const sLYXBalanceAfter = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalanceBefore).to.be.equal(ethers.utils.parseEther('0'));
      expect(sLYXBalanceAfter).to.be.equal(ethers.utils.parseEther('32'));
    });

    it('should emit Activated when activate pending deposits', async function () {
      // pending activation as 32LYX is 50% of 64LYX (current amount staked)
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });

      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await registerValidators(
        depositData,
        oracles,
        poolValidators,
        beaconDepositMock,
        [oracle],
        admin,
        operator
      );

      const nonce = await oracles.currentRewardsNonce();
      const signatures = await generateSignaturesForSubmitRewards(
        [oracle],
        nonce.toString(),
        ethers.utils.parseEther('100'),
        3
      );

      // Once the rewards are submitted with the new number of validators, the activatedValidators value is updated
      // Meaning the new maxIndex increased so we can activate our deposit
      await oracles
        .connect(oracle)
        .submitRewards(ethers.utils.parseEther('100'), 3, signatures);

      await expect(pool.connect(user1).activate(user1.address, 3))
        .to.emit(pool, 'Activated')
        .withArgs(
          user1.address,
          3,
          ethers.utils.parseEther('32'),
          user1.address
        );
    });
  });

  describe('registerValidator', function () {
    it('should be able to register a validator', async function () {
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });

      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await registerValidators(
        depositData,
        oracles,
        poolValidators,
        beaconDepositMock,
        [oracle],
        admin,
        operator
      );

      const pendingValidators = await pool.pendingValidators();
      const poolBalance = await ethers.provider.getBalance(pool.address);
      expect(pendingValidators).to.be.equal(1);
      expect(poolBalance).to.be.equal(ethers.utils.parseEther('0'));
    });

    it('should emit ValidatorRegistered when register a validator', async function () {
      await pool.connect(user1).stake({
        value: ethers.utils.parseEther('32'),
      });

      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await expect(
        registerValidators(
          depositData,
          oracles,
          poolValidators,
          beaconDepositMock,
          [oracle],
          admin,
          operator
        )
      )
        .to.emit(pool, 'ValidatorRegistered')
        .withArgs(depositData[0].publicKey, operator.address);
    });

    it('should revert if not enough LYX', async function () {
      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await expect(
        registerValidators(
          depositData,
          oracles,
          poolValidators,
          beaconDepositMock,
          [oracle],
          admin,
          operator
        )
      ).to.revertedWithoutReason();
    });

    it('should revert if invalid withdrawalCredentials', async function () {
      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      depositData[0].withdrawalCredentials = ethers.utils.randomBytes(32);
      await expect(
        registerValidators(
          depositData,
          oracles,
          poolValidators,
          beaconDepositMock,
          [oracle],
          admin,
          operator
        )
      ).to.revertedWith('Pool: invalid withdrawal credentials');
    });

    it('should revert if not called from validators contract', async function () {
      //32LYX deposited so we create a new validator
      const depositData = [getTestDepositData(operator.address)[2]];
      // So it mints directly when stake more than minActivatingDeposit

      await expect(
        pool.connect(admin).registerValidator(depositData[0])
      ).to.revertedWith('Pool: access denied');
    });
  });
});
